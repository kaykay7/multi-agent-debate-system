"""
FastAPI backend for the Multi-Agent Debate System.

Exposes a WebSocket endpoint that orchestrates a real-time debate between
AI agents using LangGraph, streaming every token to the connected client.
Supports OpenAI and Ollama as LLM providers.
"""

import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from debate.graph import build_debate_graph

load_dotenv()

debate_graph = None


def _get_default_provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama").lower()


def _build_llm(provider: str, model: str):
    """Instantiate the right LangChain chat model for the chosen provider."""
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key is not configured. Add OPENAI_API_KEY to backend/.env"
            )
        return ChatOpenAI(
            model=model or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            api_key=api_key,
            streaming=True,
            temperature=0.85,
        )

    # Default to Ollama
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    return ChatOllama(
        model=model or os.getenv("OLLAMA_MODEL", "llama3.2"),
        base_url=base_url,
        temperature=0.85,
    )


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
    """Return provider availability info so the frontend can adapt."""
    has_openai_key = bool(os.getenv("OPENAI_API_KEY"))
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
        "default_provider": _get_default_provider(),
        "openai_available": has_openai_key,
        "ollama_available": ollama_ok,
        "ollama_url": ollama_url,
    }


@app.get("/api/ollama/models")
async def list_ollama_models():
    """Fetch locally-installed Ollama model names."""
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{ollama_url}/api/tags")
            r.raise_for_status()
            data = r.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models}
    except Exception as exc:
        return {"models": [], "error": str(exc)}


@app.websocket("/ws/debate")
async def debate_ws(websocket: WebSocket):
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        topic = data.get("topic", "").strip()
        max_rounds = min(max(int(data.get("rounds", 3)), 1), 5)
        provider = data.get("provider", _get_default_provider())
        model_name = data.get("model", "")

        if not topic:
            await websocket.send_json(
                {"type": "error", "message": "Please provide a debate topic."}
            )
            return

        try:
            llm = _build_llm(provider, model_name)
        except ValueError as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})
            return

        await websocket.send_json(
            {
                "type": "debate_start",
                "topic": topic,
                "rounds": max_rounds,
                "provider": provider,
                "model": model_name or (
                    os.getenv("OPENAI_MODEL", "gpt-4o-mini")
                    if provider == "openai"
                    else os.getenv("OLLAMA_MODEL", "llama3.2")
                ),
                "agents": {
                    "pro": {"name": "The Advocate", "role": "Arguing FOR"},
                    "con": {"name": "The Skeptic", "role": "Arguing AGAINST"},
                    "moderator": {
                        "name": "The Moderator",
                        "role": "Neutral Observer",
                    },
                },
            }
        )

        initial_state = {
            "topic": topic,
            "messages": [],
            "current_round": 0,
            "max_rounds": max_rounds,
        }

        await debate_graph.ainvoke(
            initial_state,
            config={"configurable": {"websocket": websocket, "llm": llm}},
        )

        await websocket.send_json({"type": "debate_end"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass


# Serve the built frontend in production
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_BUILD):
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD, html=True), name="frontend")
