import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const SUGGESTIONS = [
  "Should AI be regulated by governments?",
  "Is remote work better than office work?",
  "Should social media be banned for teenagers?",
  "Is space exploration worth the investment?",
  "Will AI replace most human jobs within 20 years?",
  "Should college education be free for everyone?",
];

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];

export default function TopicInput({ onStart }) {
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(3);
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("");
  const [ollamaModels, setOllamaModels] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        setProviderStatus(data);
        setProvider(data.default_provider || "ollama");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (provider === "ollama") {
      fetch("/api/ollama/models")
        .then((r) => r.json())
        .then((data) => {
          setOllamaModels(data.models || []);
          if (!model && data.models?.length) setModel(data.models[0]);
        })
        .catch(() => setOllamaModels([]));
    } else {
      if (!model || !OPENAI_MODELS.includes(model)) setModel(OPENAI_MODELS[0]);
    }
  }, [provider]);

  const launch = () => {
    const t = topic.trim();
    if (t) onStart(t, rounds, provider, model);
  };

  const isOllamaUp = providerStatus?.ollama_available;
  const isOpenAIUp = providerStatus?.openai_available;
  const modelList = provider === "ollama" ? ollamaModels : OPENAI_MODELS;

  return (
    <motion.div
      className="max-w-2xl mx-auto px-6"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <div className="glass rounded-3xl p-8 md:p-10 shadow-2xl shadow-indigo-500/5">
        <h2 className="text-2xl font-display font-bold text-center mb-2">
          Choose a Debate Topic
        </h2>
        <p className="text-sm text-slate-400 text-center mb-8">
          Enter any topic and watch two AI agents battle it out
        </p>

        {/* Topic textarea */}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              launch();
            }
          }}
          placeholder="e.g. Should artificial intelligence be granted legal personhood?"
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-white
                     placeholder-slate-500 focus:outline-none focus:border-indigo-500/40
                     focus:ring-1 focus:ring-indigo-500/20 resize-none h-28 transition-all text-[15px]"
        />

        {/* Suggestions */}
        <div className="mt-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2.5">
            Quick picks
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07]
                           hover:bg-white/[0.08] hover:border-white/[0.14] transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Provider selector */}
        <div className="mt-8">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            LLM Provider
          </p>
          <div className="flex gap-3">
            {/* Ollama option */}
            <button
              onClick={() => setProvider("ollama")}
              className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all cursor-pointer
                ${
                  provider === "ollama"
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                    : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]"
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🦙</span>
                <span>Ollama</span>
                <span className="text-[10px] ml-1">
                  {isOllamaUp ? (
                    <span className="text-emerald-400">● Local</span>
                  ) : (
                    <span className="text-slate-500">● Offline</span>
                  )}
                </span>
              </div>
            </button>

            {/* OpenAI option */}
            <button
              onClick={() => setProvider("openai")}
              className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all cursor-pointer
                ${
                  provider === "openai"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]"
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">⚡</span>
                <span>OpenAI</span>
                <span className="text-[10px] ml-1">
                  {isOpenAIUp ? (
                    <span className="text-emerald-400">● Key set</span>
                  ) : (
                    <span className="text-slate-500">● No key</span>
                  )}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Model selector */}
        <div className="mt-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2.5">
            Model
          </p>
          {modelList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {modelList.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer
                    ${
                      model === m
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:bg-white/[0.06]"
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              {provider === "ollama"
                ? "No Ollama models found — make sure Ollama is running (ollama serve)"
                : "Configure OPENAI_API_KEY in backend/.env"}
            </p>
          )}
        </div>

        {/* Rounds selector */}
        <div className="mt-8 flex items-center gap-4">
          <label className="text-sm text-slate-400 whitespace-nowrap">
            Debate Rounds
          </label>
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

        {/* Launch button */}
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
