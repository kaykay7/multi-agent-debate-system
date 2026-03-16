"""
Multi-Agent Debate System — Backend
Copyright (c) 2026 Kunal Kamdar. All Rights Reserved.
Proprietary and confidential. See LICENSE for terms.

FastAPI backend for the Multi-Agent Debate System.

Supports three debate modes:
  - same_llm:    Both agents use the same provider/model
  - diff_llm:    Each agent uses a different provider/model
  - human_vs_ai: One side is a live human player

Supported LLM providers: Ollama, OpenAI, Anthropic (Claude), xAI (Grok), Google (Gemini)
"""

import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from debate.graph import Speaker, _HAS_SAY, build_debate_graph
from debate.guardrails import TOPIC_SUGGESTIONS, check_content

load_dotenv()

debate_graph = None


def _build_llm(provider: str, model: str, api_key: str = ""):
    """Instantiate a LangChain chat model for the given provider."""

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        return ChatOllama(
            model=model or os.getenv("OLLAMA_MODEL", "llama3.2:1b"),
            base_url=base_url,
            temperature=0.85,
        )

    if not api_key:
        env_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "xai": "XAI_API_KEY",
            "google": "GOOGLE_API_KEY",
        }
        api_key = os.getenv(env_map.get(provider, ""), "")
    if not api_key:
        raise ValueError(f"API key is required for {provider}")

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            api_key=api_key,
            streaming=True,
            temperature=0.85,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=model or "claude-sonnet-4-20250514",
            api_key=api_key,
            streaming=True,
            temperature=0.85,
        )

    if provider == "xai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model or "grok-2",
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            streaming=True,
            temperature=0.85,
        )

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model or "gemini-1.5-flash",
            google_api_key=api_key,
            streaming=True,
            temperature=0.85,
        )

    raise ValueError(f"Unknown provider: {provider}")


def _llm_from_config(cfg: dict):
    """Build an LLM from a {provider, model, api_key} dict."""
    return _build_llm(cfg.get("provider", "ollama"), cfg.get("model", ""), cfg.get("apiKey", ""))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global debate_graph
    debate_graph = build_debate_graph()
    yield


app = FastAPI(title="Multi-Agent Debate System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    has_openai_key = bool(os.getenv("OPENAI_API_KEY"))
    has_google_key = bool(os.getenv("GOOGLE_API_KEY"))
    has_anthropic_key = bool(os.getenv("ANTHROPIC_API_KEY"))
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            r = await client.get(f"{ollama_url}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        pass
    return {
        "status": "ok",
        "default_provider": os.getenv("LLM_PROVIDER", "ollama").lower(),
        "openai_available": has_openai_key,
        "google_available": has_google_key,
        "anthropic_available": has_anthropic_key,
        "ollama_available": ollama_ok,
    }


@app.get("/api/ollama/models")
async def list_ollama_models():
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{ollama_url}/api/tags")
            r.raise_for_status()
            return {"models": [m["name"] for m in r.json().get("models", [])]}
    except Exception as exc:
        return {"models": [], "error": str(exc)}


@app.get("/api/suggestions/{age_tier}")
async def get_suggestions(age_tier: str):
    suggestions = TOPIC_SUGGESTIONS.get(age_tier, TOPIC_SUGGESTIONS["adults"])
    return {"age_tier": age_tier, "suggestions": suggestions}


def _build_agent_info(mode, data):
    """Return (configurable_dict, agents_metadata) for the given mode."""

    if mode == "same_llm":
        cfg = data.get("config", {})
        llm = _llm_from_config(cfg)
        model_label = cfg.get("model", "")
        return {
            "llm_pro": llm,
            "llm_con": llm,
            "llm_moderator": llm,
            "human_side": None,
        }, {
            "pro": {"name": "The Advocate", "role": f"Arguing FOR", "model": model_label},
            "con": {"name": "The Skeptic", "role": f"Arguing AGAINST", "model": model_label},
            "moderator": {"name": "The Moderator", "role": "Neutral Observer"},
        }

    if mode == "diff_llm":
        pro_cfg = data.get("pro_config", {})
        con_cfg = data.get("con_config", {})
        llm_pro = _llm_from_config(pro_cfg)
        llm_con = _llm_from_config(con_cfg)
        # Moderator defaults to pro agent's model
        llm_mod = _llm_from_config(pro_cfg)
        pro_label = f"{pro_cfg.get('provider', '').upper()} {pro_cfg.get('model', '')}"
        con_label = f"{con_cfg.get('provider', '').upper()} {con_cfg.get('model', '')}"
        return {
            "llm_pro": llm_pro,
            "llm_con": llm_con,
            "llm_moderator": llm_mod,
            "human_side": None,
        }, {
            "pro": {"name": "The Advocate", "role": f"{pro_label} · FOR"},
            "con": {"name": "The Skeptic", "role": f"{con_label} · AGAINST"},
            "moderator": {"name": "The Moderator", "role": "Neutral Observer"},
        }

    if mode == "human_vs_ai":
        human_side = data.get("human_side", "con")
        ai_cfg = data.get("ai_config", {})
        llm_ai = _llm_from_config(ai_cfg)
        ai_label = f"{ai_cfg.get('provider', '').upper()} {ai_cfg.get('model', '')}"

        # Build LLMs: human side gets None (won't be called)
        llm_pro = None if human_side == "pro" else llm_ai
        llm_con = None if human_side == "con" else llm_ai
        llm_mod = llm_ai

        pro_info = (
            {"name": "You", "role": "Human · FOR", "is_human": True}
            if human_side == "pro"
            else {"name": "The Advocate", "role": f"{ai_label} · FOR"}
        )
        con_info = (
            {"name": "You", "role": "Human · AGAINST", "is_human": True}
            if human_side == "con"
            else {"name": "The Skeptic", "role": f"{ai_label} · AGAINST"}
        )

        return {
            "llm_pro": llm_pro,
            "llm_con": llm_con,
            "llm_moderator": llm_mod,
            "human_side": human_side,
        }, {
            "pro": pro_info,
            "con": con_info,
            "moderator": {"name": "The Moderator", "role": "Neutral Observer"},
        }

    raise ValueError(f"Unknown mode: {mode}")


@app.websocket("/ws/debate")
async def debate_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        topic = data.get("topic", "").strip()
        max_rounds = min(max(int(data.get("rounds", 3)), 1), 5)
        mode = data.get("mode", "same_llm")
        age_tier = data.get("age_tier", "adults")
        if age_tier not in ("kids", "teens", "adults"):
            age_tier = "adults"

        if not topic:
            await websocket.send_json(
                {"type": "error", "message": "Please provide a debate topic."}
            )
            return

        # Guardrail: check if the topic itself is appropriate for the age tier
        topic_check = check_content(topic, age_tier)
        if not topic_check["ok"]:
            await websocket.send_json(
                {"type": "error", "message": topic_check["reason"]}
            )
            return

        try:
            configurable, agents_meta = _build_agent_info(mode, data)
        except ValueError as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})
            return

        configurable["websocket"] = websocket
        configurable["age_tier"] = age_tier

        # Server-side TTS via macOS `say`
        speaker = None
        if _HAS_SAY:
            speaker = Speaker()
            speaker.start()
        configurable["speaker"] = speaker

        await websocket.send_json(
            {
                "type": "debate_start",
                "topic": topic,
                "rounds": max_rounds,
                "mode": mode,
                "agents": agents_meta,
            }
        )

        initial_state = {
            "topic": topic,
            "messages": [],
            "current_round": 0,
            "max_rounds": max_rounds,
        }

        try:
            await debate_graph.ainvoke(
                initial_state,
                config={"configurable": configurable},
            )
        finally:
            if speaker:
                await speaker.stop()

        await websocket.send_json({"type": "debate_end"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_BUILD):
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD, html=True), name="frontend")
