import { motion } from "framer-motion";

const MODES = [
  {
    id: "same_llm",
    title: "AI vs AI",
    subtitle: "Same Model",
    description:
      "Both agents are powered by the same LLM. Watch one model argue both sides of any topic.",
    icon: (
      <div className="flex items-center gap-1 text-2xl">
        <span>🤖</span>
        <span className="text-lg text-indigo-400">⚔</span>
        <span>🤖</span>
      </div>
    ),
    accent: "indigo",
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "diff_llm",
    title: "AI vs AI",
    subtitle: "Different Models",
    description:
      "Pit different LLMs head-to-head. GPT vs Claude, Grok vs Gemini, or any combination.",
    icon: (
      <div className="flex items-center gap-1 text-2xl">
        <span>⚡</span>
        <span className="text-lg text-purple-400">VS</span>
        <span>🧠</span>
      </div>
    ),
    accent: "purple",
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "human_vs_ai",
    title: "Human vs AI",
    subtitle: "You Debate",
    description:
      "Step into the arena yourself. Argue your case against a formidable AI opponent.",
    icon: (
      <div className="flex items-center gap-1 text-2xl">
        <span>👤</span>
        <span className="text-lg text-amber-400">⚔</span>
        <span>🤖</span>
      </div>
    ),
    accent: "amber",
    gradient: "from-amber-600 to-red-600",
  },
];

const accentMap = {
  indigo: {
    border: "hover:border-indigo-500/30",
    bg: "hover:bg-indigo-500/[0.04]",
    ring: "group-hover:shadow-indigo-500/10",
  },
  purple: {
    border: "hover:border-purple-500/30",
    bg: "hover:bg-purple-500/[0.04]",
    ring: "group-hover:shadow-purple-500/10",
  },
  amber: {
    border: "hover:border-amber-500/30",
    bg: "hover:bg-amber-500/[0.04]",
    ring: "group-hover:shadow-amber-500/10",
  },
};

export default function ModeSelector({ onSelect, onBack }) {
  return (
    <motion.div
      className="max-w-4xl mx-auto px-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {onBack && (
        <div className="mb-4">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
          >
            ← Change age group
          </button>
        </div>
      )}
      <h2 className="text-2xl font-display font-bold text-center mb-2">
        Choose Debate Mode
      </h2>
      <p className="text-sm text-slate-400 text-center mb-8">
        How do you want the debate to be structured?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODES.map((mode, i) => {
          const a = accentMap[mode.accent];
          return (
            <motion.button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`group glass rounded-2xl p-6 text-left transition-all cursor-pointer
                border border-white/[0.06] ${a.border} ${a.bg}
                shadow-lg ${a.ring} group-hover:shadow-xl`}
            >
              <div className="mb-4">{mode.icon}</div>

              <h3 className="font-display font-bold text-lg leading-tight">
                {mode.title}
              </h3>
              <p
                className={`text-xs font-bold mt-0.5 bg-gradient-to-r ${mode.gradient} bg-clip-text text-transparent`}
              >
                {mode.subtitle}
              </p>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                {mode.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
