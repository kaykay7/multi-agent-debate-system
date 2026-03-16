"""
Multi-Agent Debate System — Orchestration Graph
Copyright (c) 2026 Kunal Kamdar. All Rights Reserved.
Proprietary and confidential. See LICENSE for terms.

LangGraph multi-agent debate orchestration.

Supports three modes:
  - same_llm:    Both agents share one model
  - diff_llm:    Each agent uses its own model (e.g. GPT-4o vs Claude)
  - human_vs_ai: One side is a live human player

Graph topology:

  moderator_intro -> pro_argument -> con_argument -> increment_round
                        ^                                  |
                        |        (round <= max)            |  (round > max)
                        +----------------------------------+-------> moderator_summary -> END
"""

import asyncio
import operator
import re
import shutil
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, StateGraph

from .guardrails import check_content, sanitize_output
from .prompts import (
    CON_AGENT_PROMPT,
    MODERATOR_INTRO_PROMPT,
    MODERATOR_SUMMARY_PROMPT,
    PRO_AGENT_PROMPT,
    get_prompt,
)

# macOS voice assignments for each agent
_VOICE_MAP = {
    "moderator": "Daniel",
    "pro": "Fred",
    "con": "Karen",
}

_HAS_SAY = shutil.which("say") is not None


class Speaker:
    """Queued TTS using macOS `say`. Sentences are spoken sequentially so they
    don't overlap. All operations are non-blocking for the caller."""

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._task: asyncio.Task | None = None
        self._proc: asyncio.subprocess.Process | None = None

    def start(self):
        self._task = asyncio.create_task(self._worker())

    async def _worker(self):
        while True:
            item = await self._queue.get()
            if item is None:
                break
            text, voice = item
            try:
                self._proc = await asyncio.create_subprocess_exec(
                    "say", "-v", voice, "--", text,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await self._proc.wait()
            except Exception:
                pass
            finally:
                self._proc = None

    async def speak(self, text: str, agent: str = "moderator"):
        voice = _VOICE_MAP.get(agent, "Fred")
        await self._queue.put((text, voice))

    async def cancel(self):
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.kill()
            except Exception:
                pass

    async def stop(self):
        await self.cancel()
        await self._queue.put(None)
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except asyncio.TimeoutError:
                self._task.cancel()


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


def _get_speaker(config: RunnableConfig) -> Speaker | None:
    return config["configurable"].get("speaker")


def _get_age_tier(config: RunnableConfig) -> str:
    return config["configurable"].get("age_tier", "adults")


async def _stream_llm(llm, messages, ws, agent_id: str,
                       speaker: Speaker | None = None,
                       age_tier: str = "adults") -> str:
    """Call the LLM with streaming, push tokens over WebSocket, sanitize
    output through age guardrails, and speak completed sentences."""
    full_text = ""
    sentence_buf = ""

    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            safe_token = sanitize_output(token, age_tier)
            full_text += safe_token
            await ws.send_json({"type": "token", "agent": agent_id, "content": safe_token})

            if speaker:
                sentence_buf += safe_token
                while True:
                    m = re.search(r"[.!?;:]\s", sentence_buf)
                    if not m:
                        break
                    end = m.end()
                    sentence = sentence_buf[:end].strip()
                    sentence_buf = sentence_buf[end:]
                    if sentence:
                        await speaker.speak(sentence, agent_id)

    if speaker and sentence_buf.strip():
        await speaker.speak(sentence_buf.strip(), agent_id)

    return full_text


async def _human_turn(ws, agent: str, rnd: int, age_tier: str = "adults") -> str:
    """Pause the graph and wait for the human player's argument.
    Validates the input against age guardrails before accepting."""
    await ws.send_json({"type": "human_turn", "agent": agent, "round": rnd})

    while True:
        data = await ws.receive_json()
        if data.get("type") == "human_response":
            text = data.get("content", "").strip()
            result = check_content(text, age_tier)
            if not result["ok"]:
                await ws.send_json({
                    "type": "guardrail_block",
                    "message": result["reason"],
                    "agent": agent,
                    "round": rnd,
                })
                continue
            break

    await ws.send_json(
        {"type": "agent_start", "agent": agent, "round": rnd, "phase": "debate"}
    )
    await ws.send_json({"type": "token", "agent": agent, "content": text})
    await ws.send_json({"type": "agent_end", "agent": agent})
    return text


def _get_llm(config: RunnableConfig, key: str):
    return config["configurable"][key]


# ── Graph nodes ──────────────────────────────────────────────────────────────


async def moderator_intro(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    llm = _get_llm(config, "llm_moderator")
    speaker = _get_speaker(config)
    age_tier = _get_age_tier(config)

    await ws.send_json(
        {"type": "agent_start", "agent": "moderator", "round": 0, "phase": "intro"}
    )
    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=get_prompt(MODERATOR_INTRO_PROMPT, age_tier)),
            HumanMessage(content=f'The debate topic is: "{state["topic"]}"'),
        ],
        ws,
        "moderator",
        speaker,
        age_tier,
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
    rnd = state["current_round"]
    human_side = config["configurable"].get("human_side")
    age_tier = _get_age_tier(config)

    if human_side == "pro":
        text = await _human_turn(ws, "pro", rnd, age_tier)
    else:
        llm = _get_llm(config, "llm_pro")
        speaker = _get_speaker(config)
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
                SystemMessage(content=get_prompt(PRO_AGENT_PROMPT, age_tier)),
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
            speaker,
            age_tier,
        )
        await ws.send_json({"type": "agent_end", "agent": "pro"})

    return {
        "messages": [
            {"agent": "pro", "content": text, "round": rnd, "phase": "debate"}
        ],
    }


async def con_argument(state: DebateState, config: RunnableConfig) -> dict:
    ws = config["configurable"]["websocket"]
    rnd = state["current_round"]
    human_side = config["configurable"].get("human_side")
    age_tier = _get_age_tier(config)

    if human_side == "con":
        text = await _human_turn(ws, "con", rnd, age_tier)
    else:
        llm = _get_llm(config, "llm_con")
        speaker = _get_speaker(config)
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
                SystemMessage(content=get_prompt(CON_AGENT_PROMPT, age_tier)),
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
            speaker,
            age_tier,
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
    llm = _get_llm(config, "llm_moderator")
    speaker = _get_speaker(config)
    age_tier = _get_age_tier(config)

    await ws.send_json(
        {"type": "agent_start", "agent": "moderator", "round": 0, "phase": "summary"}
    )
    history = _format_history(state["messages"])
    text = await _stream_llm(
        llm,
        [
            SystemMessage(content=get_prompt(MODERATOR_SUMMARY_PROMPT, age_tier)),
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
        speaker,
        age_tier,
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
