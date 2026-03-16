import { useCallback, useRef, useState } from "react";

const INITIAL_STATE = {
  status: "idle", // idle | connecting | debating | complete | error
  topic: "",
  mode: "same_llm",
  maxRounds: 0,
  currentRound: 0,
  currentAgent: null,
  currentPhase: null,
  isHumanTurn: false,
  humanTurnAgent: null,
  messages: [],
  agents: null,
  error: null,
};

export default function useDebateWebSocket() {
  const [state, setState] = useState(INITIAL_STATE);
  const wsRef = useRef(null);
  const contentRef = useRef("");

  const startDebate = useCallback((payload) => {
    setState((s) => ({ ...s, status: "connecting" }));

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/debate`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "debate_start":
          setState((s) => ({
            ...s,
            status: "debating",
            topic: data.topic,
            maxRounds: data.rounds,
            mode: data.mode,
            agents: data.agents,
          }));
          break;

        case "agent_start":
          contentRef.current = "";
          setState((s) => ({
            ...s,
            currentAgent: data.agent,
            currentPhase: data.phase || "debate",
            currentRound: data.round > 0 ? data.round : s.currentRound,
            isHumanTurn: false,
            humanTurnAgent: null,
            messages: [
              ...s.messages,
              {
                agent: data.agent,
                content: "",
                round: data.round,
                phase: data.phase || "debate",
              },
            ],
          }));
          break;

        case "token": {
          contentRef.current += data.content;
          const snapshot = contentRef.current;
          setState((s) => {
            const msgs = [...s.messages];
            const last = msgs.length - 1;
            if (last >= 0) {
              msgs[last] = { ...msgs[last], content: snapshot };
            }
            return { ...s, messages: msgs };
          });
          break;
        }

        case "agent_end":
          setState((s) => ({ ...s, currentAgent: null, currentPhase: null }));
          break;

        case "human_turn":
          setState((s) => ({
            ...s,
            isHumanTurn: true,
            humanTurnAgent: data.agent,
            currentRound: data.round > 0 ? data.round : s.currentRound,
          }));
          break;

        case "debate_end":
          setState((s) => ({ ...s, status: "complete", currentAgent: null }));
          ws.close();
          break;

        case "error":
          setState((s) => ({
            ...s,
            status: "error",
            error: data.message,
            currentAgent: null,
          }));
          ws.close();
          break;
      }
    };

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        status: "error",
        error: "WebSocket connection failed. Is the backend running?",
      }));
    };

    ws.onclose = () => {
      setState((prev) => {
        if (prev.status === "debating" || prev.status === "connecting") {
          return {
            ...prev,
            status: "error",
            error: "Connection closed unexpectedly.",
            currentAgent: null,
          };
        }
        return prev;
      });
    };
  }, []);

  const sendHumanResponse = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "human_response", content }));
      setState((s) => ({ ...s, isHumanTurn: false, humanTurnAgent: null }));
    }
  }, []);

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { ...state, startDebate, sendHumanResponse, reset };
}
