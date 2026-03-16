import { motion } from "framer-motion";

const TIERS = [
  {
    id: "kids",
    label: "Kids",
    age: "8 – 12",
    icon: "🧒",
    desc: "Fun, educational topics with strict content safety. Perfect for young learners.",
    color: "from-green-500 to-emerald-500",
    border: "border-green-500/30",
    bg: "bg-green-500/[0.06]",
    text: "text-green-400",
  },
  {
    id: "teens",
    label: "Teens",
    age: "13 – 17",
    icon: "🧑‍🎓",
    desc: "Thoughtful topics on society, tech, and ethics. Moderate content filtering.",
    color: "from-blue-500 to-indigo-500",
    border: "border-blue-500/30",
    bg: "bg-blue-500/[0.06]",
    text: "text-blue-400",
  },
  {
    id: "adults",
    label: "Adults",
    age: "18 +",
    icon: "🧑‍💼",
    desc: "Complex, nuanced debates on any topic. Light guardrails for responsible discourse.",
    color: "from-purple-500 to-pink-500",
    border: "border-purple-500/30",
    bg: "bg-purple-500/[0.06]",
    text: "text-purple-400",
  },
];

export default function AgeGate({ onSelect }) {
  return (
    <div className="max-w-3xl mx-auto px-6">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
          Select Your Age Group
        </h2>
        <p className="text-slate-400 text-sm">
          Content and topics will be tailored to your age range
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier, i) => (
          <motion.button
            key={tier.id}
            onClick={() => onSelect(tier.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative text-left p-6 rounded-2xl border backdrop-blur-sm
              ${tier.bg} ${tier.border} hover:border-opacity-60
              transition-all cursor-pointer`}
          >
            <div className="text-3xl mb-3">{tier.icon}</div>
            <h3 className="font-display text-lg font-bold text-white mb-0.5">
              {tier.label}
            </h3>
            <span className={`text-xs font-semibold ${tier.text}`}>
              Age {tier.age}
            </span>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              {tier.desc}
            </p>
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gradient-to-r ${tier.color}
                opacity-0 group-hover:opacity-100 transition-opacity`}
            />
          </motion.button>
        ))}
      </div>

      <motion.p
        className="text-center text-slate-600 text-[11px] mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Content guardrails are enforced on both input and AI output
      </motion.p>
    </div>
  );
}
