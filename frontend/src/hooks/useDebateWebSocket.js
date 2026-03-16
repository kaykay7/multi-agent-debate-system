import { useCallback, useRef, useState } from "react";

const INITIAL_STATE = {
  status: "idle", // idle | connecting | debating | complete | error
  topic: "",
  maxRounds: 0,
  currentRound: 0,
  currentAgent: null,
  currentPhase: null, // intro | debate | summary
  messages: [],
  error: null,
};

export default function useDebateWebSocket() {
  const [state, setState] = useState(INITIAL_STATE);
  const wsRef = useRef(null);
  const contentRef = useRef("");

  const startDebate = useCallback(
    (topic, rounds = 3, provider = "ollama", model = "") => {
      setState((s) => ({ ...s, status: "connecting" }));

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/debate`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ topic, rounds, provider, model }));
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
          }));
          break;

        case "agent_start":
          contentRef.current = "";
          setState((s) => ({
            ...s,
            currentAgent: data.agent,
            currentPhase: data.phase || "debate",
            currentRound: data.round > 0 ? data.round : s.currentRound,
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

    ws.onclose = (event) => {
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
    },
    [],
  );

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { ...state, startDebate, reset };
}
