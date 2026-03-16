import { useEffect } from "react";

const PROVIDERS = [
  {
    id: "ollama",
    name: "Ollama",
    icon: "🦙",
    requiresKey: false,
    models: [],
    description: "Local",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "⚡",
    requiresKey: true,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    description: "GPT",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "🧠",
    requiresKey: true,
    models: [
      "claude-sonnet-4-20250514",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    description: "Claude",
  },
  {
    id: "xai",
    name: "xAI",
    icon: "𝕏",
    requiresKey: true,
    models: ["grok-2", "grok-2-mini"],
    description: "Grok",
  },
  {
    id: "google",
    name: "Google",
    icon: "🔷",
    requiresKey: true,
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    description: "Gemini",
  },
];

export default function LLMConfig({ label, value, onChange, ollamaModels = [] }) {
  const { provider, model, apiKey } = value;
  const providerInfo = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const modelList =
    provider === "ollama" ? ollamaModels : providerInfo.models;

  const update = (patch) => onChange({ ...value, ...patch });

  // Auto-select first model when provider changes
  useEffect(() => {
    if (modelList.length > 0 && !modelList.includes(model)) {
      update({ model: modelList[0] });
    }
  }, [provider, modelList.length]);

  return (
    <div className="space-y-4">
      {label && (
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </p>
      )}

      {/* Provider selector */}
      <div className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => update({ provider: p.id, model: "", apiKey: p.id === "ollama" ? "" : apiKey })}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all cursor-pointer
              ${
                provider === p.id
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]"
              }`}
          >
            <span>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Model selector */}
      {modelList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {modelList.map((m) => (
            <button
              key={m}
              onClick={() => update({ model: m })}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer
                ${
                  model === m
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.05]"
                }`}
            >
              {m}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 italic">
          {provider === "ollama"
            ? "No Ollama models found — run: ollama pull llama3.2:1b"
            : "Select a provider"}
        </p>
      )}

      {/* API key input */}
      {providerInfo.requiresKey && (
        <input
          type="password"
          placeholder={`${providerInfo.name} API key`}
          value={apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs
                     text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/30
                     focus:ring-1 focus:ring-indigo-500/20 transition-all"
        />
      )}
    </div>
  );
}
