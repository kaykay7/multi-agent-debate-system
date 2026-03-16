import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import LLMConfig from "./LLMConfig";

const FALLBACK_SUGGESTIONS = [
  "Should AI be regulated by governments?",
  "Is remote work better than office work?",
  "Is space exploration worth the investment?",
];

const AGE_LABELS = {
  kids: "Kids (8–12)",
  teens: "Teens (13–17)",
  adults: "Adults (18+)",
};

const DEFAULT_CONFIG = { provider: "ollama", model: "", apiKey: "" };

export default function DebateSetup({ mode, ageTier, onStart, onBack }) {
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(3);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS);
  const [serverKeys, setServerKeys] = useState({});

  // same_llm
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });

  // diff_llm
  const [proConfig, setProConfig] = useState({ ...DEFAULT_CONFIG });
  const [conConfig, setConConfig] = useState({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "",
  });

  // human_vs_ai
  const [humanSide, setHumanSide] = useState("con");
  const [aiConfig, setAiConfig] = useState({ ...DEFAULT_CONFIG });

  useEffect(() => {
    fetch("/api/ollama/models")
      .then((r) => r.json())
      .then((d) => setOllamaModels(d.models || []))
      .catch(() => {});
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setServerKeys({
          openai: d.openai_available,
          google: d.google_available,
          anthropic: d.anthropic_available,
          ollama: d.ollama_available,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/suggestions/${ageTier || "adults"}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions || FALLBACK_SUGGESTIONS))
      .catch(() => {});
  }, [ageTier]);

  const launch = () => {
    const t = topic.trim();
    if (!t) return;

    const base = { mode, topic: t, rounds, age_tier: ageTier };
    if (mode === "same_llm") {
      onStart({ ...base, config });
    } else if (mode === "diff_llm") {
      onStart({ ...base, pro_config: proConfig, con_config: conConfig });
    } else {
      onStart({ ...base, human_side: humanSide, ai_config: aiConfig });
    }
  };

  const modeLabel =
    mode === "same_llm"
      ? "AI vs AI · Same Model"
      : mode === "diff_llm"
        ? "AI vs AI · Different Models"
        : "Human vs AI";

  return (
    <motion.div
      className="max-w-2xl mx-auto px-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="glass rounded-3xl p-8 md:p-10 shadow-2xl shadow-indigo-500/5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
          >
            ← Back
          </button>
          <div className="flex-1 text-center">
            <span className="text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {modeLabel}
            </span>
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
              {AGE_LABELS[ageTier] || ageTier}
            </span>
          </div>
          <div className="w-12" />
        </div>

        {/* Mode-specific config */}
        {mode === "same_llm" && (
          <div className="mb-6">
            <LLMConfig
              label="LLM Provider"
              value={config}
              onChange={setConfig}
              ollamaModels={ollamaModels}
              serverKeys={serverKeys}
            />
          </div>
        )}

        {mode === "diff_llm" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-blue-500/[0.04] border border-blue-500/10">
              <p className="text-xs font-bold text-blue-400 mb-3">
                🗡️ The Advocate (Pro)
              </p>
              <LLMConfig
                value={proConfig}
                onChange={setProConfig}
                ollamaModels={ollamaModels}
                serverKeys={serverKeys}
              />
            </div>
            <div className="p-4 rounded-xl bg-red-500/[0.04] border border-red-500/10">
              <p className="text-xs font-bold text-red-400 mb-3">
                🛡️ The Skeptic (Con)
              </p>
              <LLMConfig
                value={conConfig}
                onChange={setConConfig}
                ollamaModels={ollamaModels}
                serverKeys={serverKeys}
              />
            </div>
          </div>
        )}

        {mode === "human_vs_ai" && (
          <div className="mb-6 space-y-4">
            {/* Side picker */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Your side
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setHumanSide("pro")}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer
                    ${
                      humanSide === "pro"
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                        : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]"
                    }`}
                >
                  🗡️ Argue FOR
                </button>
                <button
                  onClick={() => setHumanSide("con")}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer
                    ${
                      humanSide === "con"
                        ? "bg-red-500/15 border-red-500/30 text-red-300"
                        : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]"
                    }`}
                >
                  🛡️ Argue AGAINST
                </button>
              </div>
            </div>

            {/* AI opponent config */}
            <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/10">
              <p className="text-xs font-bold text-purple-400 mb-3">
                🤖 AI Opponent
              </p>
              <LLMConfig
                value={aiConfig}
                onChange={setAiConfig}
                ollamaModels={ollamaModels}
                serverKeys={serverKeys}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/[0.06] my-6" />

        {/* Topic */}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              launch();
            }
          }}
          placeholder="Enter a debate topic…"
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-white
                     placeholder-slate-500 focus:outline-none focus:border-indigo-500/40
                     focus:ring-1 focus:ring-indigo-500/20 resize-none h-24 transition-all text-[15px]"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setTopic(s)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]
                         hover:bg-white/[0.07] transition-all cursor-pointer text-slate-400"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Rounds */}
        <div className="mt-6 flex items-center gap-4">
          <label className="text-sm text-slate-400 whitespace-nowrap">Rounds</label>
          <input
            type="range"
            min={1}
            max={5}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xl font-display font-bold w-6 text-center tabular-nums">
            {rounds}
          </span>
        </div>

        {/* Launch */}
        <motion.button
          onClick={launch}
          disabled={!topic.trim()}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="mt-8 w-full py-4 rounded-2xl font-display font-bold text-lg
                     bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
                     hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          Launch Debate
        </motion.button>
      </div>
    </motion.div>
  );
}
