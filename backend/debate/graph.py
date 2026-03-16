"""
LangGraph multi-agent debate orchestration.

Graph topology:

  moderator_intro ─► pro_argument ─► con_argument ─► increment_round
                        ▲                                   │
                        │         ┌─────────────────────────┤
                        │         │ (current_round ≤ max)   │ (current_round > max)
                        └─────────┘                         ▼
                                                    moderator_summary ─► END

Each node streams LLM tokens to the client over WebSocket in real time.
"""

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, StateGraph

from .prompts import (
    CON_AGENT_PROMPT,
    MODERATOR_INTRO_PROMPT,
    MODERATOR_SUMMARY_PROMPT,
    PRO_AGENT_PROMPT,
)


class DebateState(TypedDict):
    topic: str
    messages: Annotated[list, operator.add]
    current_round: int
    max_rounds: int


def _format_history(messages: list[dict]) -> str:
    labels = {
        "moderator": "MODERATOR",
        "pro": "THE ADVOCATE (PRO)",
        "con": "THE SKEPTIC (CON)",
    }
    parts = []
    for msg in messages:
        label = labels.get(msg["agent"], msg["agent"].upper())
        parts.append(f"[{label}]:\n{msg['content']}")
    return "\n\n---\n\n".join(parts)


async def _stream_llm(llm, messages, ws, agent_id: str) -> str:
    """Call the LLM with streaming and push every token over the WebSocket."""
    full_text = ""
    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            full_text += token
            await ws.send_json({"type": "token", "agent": agent_id, "content": token})
    return full_text


# ── Graph nodes ──────────────────────────────────────────────────────────────


async def moderator_intro(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    llm = config["configurable"]["llm"]

    await ws.send_json(
        {"type": "agent_start", "agent": "moderator", "round": 0, "phase": "intro"}
    )

    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=MODERATOR_INTRO_PROMPT),
            HumanMessage(content=f'The debate topic is: "{state["topic"]}"'),
        ],
        ws,
        "moderator",
    )

    await ws.send_json({"type": "agent_end", "agent": "moderator"})

    return {
        "messages": [
            {"agent": "moderator", "content": text, "round": 0, "phase": "intro"}
        ],
        "current_round": 1,
    }


async def pro_argument(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    llm = config["configurable"]["llm"]
    rnd = state["current_round"]

    await ws.send_json(
        {"type": "agent_start", "agent": "pro", "round": rnd, "phase": "debate"}
    )

    history = _format_history(state["messages"])
    instruction = (
        "Present your opening argument FOR the topic. Make it compelling and well-structured."
        if rnd == 1
        else (
            "Respond to The Skeptic's latest arguments. Counter their points and "
            "strengthen your position FOR the topic with new evidence and reasoning."
        )
    )

    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=PRO_AGENT_PROMPT),
            HumanMessage(
                content=(
                    f'Topic: "{state["topic"]}"\n'
                    f"Round {rnd} of {state['max_rounds']}\n\n"
                    f"Debate transcript so far:\n{history}\n\n{instruction}"
                )
            ),
        ],
        ws,
        "pro",
    )

    await ws.send_json({"type": "agent_end", "agent": "pro"})

    return {
        "messages": [
            {"agent": "pro", "content": text, "round": rnd, "phase": "debate"}
        ],
    }


async def con_argument(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    llm = config["configurable"]["llm"]
    rnd = state["current_round"]

    await ws.send_json(
        {"type": "agent_start", "agent": "con", "round": rnd, "phase": "debate"}
    )

    history = _format_history(state["messages"])
    instruction = (
        "Present your opening argument AGAINST the topic. Challenge the premise "
        "and present compelling counter-evidence."
        if rnd == 1
        else (
            "Respond to The Advocate's latest arguments. Dismantle their points and "
            "strengthen your position AGAINST the topic with new counter-arguments."
        )
    )

    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=CON_AGENT_PROMPT),
            HumanMessage(
                content=(
                    f'Topic: "{state["topic"]}"\n'
                    f"Round {rnd} of {state['max_rounds']}\n\n"
                    f"Debate transcript so far:\n{history}\n\n{instruction}"
                )
            ),
        ],
        ws,
        "con",
    )

    await ws.send_json({"type": "agent_end", "agent": "con"})

    return {
        "messages": [
            {"agent": "con", "content": text, "round": rnd, "phase": "debate"}
        ],
    }


async def increment_round(state: DebateState, config: RunnableConfig) -> dict:
    return {"current_round": state["current_round"] + 1}


def should_continue(state: DebateState) -> str:
    if state["current_round"] > state["max_rounds"]:
        return "summarize"
    return "next_round"


async def moderator_summary(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    llm = config["configurable"]["llm"]

    await ws.send_json(
        {"type": "agent_start", "agent": "moderator", "round": 0, "phase": "summary"}
    )

    history = _format_history(state["messages"])
    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=MODERATOR_SUMMARY_PROMPT),
            HumanMessage(
                content=(
                    f'Topic: "{state["topic"]}"\n\n'
                    f"Complete debate transcript:\n{history}\n\n"
                    "Please provide your final synthesis and analysis."
                )
            ),
        ],
        ws,
        "moderator",
    )

    await ws.send_json({"type": "agent_end", "agent": "moderator"})

    return {
        "messages": [
            {"agent": "moderator", "content": text, "round": 0, "phase": "summary"}
        ],
    }


# ── Graph construction ───────────────────────────────────────────────────────


def build_debate_graph():
    """Build and compile the multi-agent debate state graph."""

    builder = StateGraph(DebateState)

    builder.add_node("moderator_intro", moderator_intro)
    builder.add_node("pro_argument", pro_argument)
    builder.add_node("con_argument", con_argument)
    builder.add_node("increment_round", increment_round)
    builder.add_node("moderator_summary", moderator_summary)

    builder.set_entry_point("moderator_intro")
    builder.add_edge("moderator_intro", "pro_argument")
    builder.add_edge("pro_argument", "con_argument")
    builder.add_edge("con_argument", "increment_round")
    builder.add_conditional_edges(
        "increment_round",
        should_continue,
        {"next_round": "pro_argument", "summarize": "moderator_summary"},
    )
    builder.add_edge("moderator_summary", END)

    return builder.compile()
