import { motion } from "framer-motion";

export default function AgentAvatar({ agent, isSpeaking, side }) {
  const isLeft = side === "left";

  return (
    <motion.div
      className="flex flex-col items-center gap-3 select-none"
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Avatar container */}
      <div className="relative">
        {/* Outer glow */}
        <motion.div
          className="absolute -inset-3 rounded-full blur-2xl"
          style={{ backgroundColor: agent.color }}
          animate={{
            opacity: isSpeaking ? [0.15, 0.4, 0.15] : 0.08,
            scale: isSpeaking ? [1, 1.2, 1] : 1,
          }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        />

        {/* Ring + image */}
        <div
          className="avatar-ring relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden"
          style={{ "--ring-color": agent.color }}
        >
          <img
            src={agent.avatar}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Sound bars when speaking */}
        {isSpeaking && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full"
                style={{ backgroundColor: agent.color }}
                animate={{ height: [4, 14, 4] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.45,
                  delay: i * 0.08,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="text-center mt-1">
        <p className="font-display font-bold text-sm md:text-base">{agent.name}</p>
        <p className="text-[11px] text-slate-400">{agent.role}</p>
      </div>
    </motion.div>
  );
}
