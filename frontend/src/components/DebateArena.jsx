import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentAvatar from "./AgentAvatar";

const AGENTS = {
  pro: {
    name: "The Advocate",
    role: "Arguing FOR",
    color: "#3b82f6",
    avatar: "/avatars/pro.png",
    bubbleBg: "bg-blue-500/[0.07]",
    bubbleBorder: "border-blue-500/20",
    dotColor: "bg-blue-400",
    labelColor: "text-blue-400",
  },
  con: {
    name: "The Skeptic",
    role: "Arguing AGAINST",
    color: "#ef4444",
    avatar: "/avatars/con.png",
    bubbleBg: "bg-red-500/[0.07]",
    bubbleBorder: "border-red-500/20",
    dotColor: "bg-red-400",
    labelColor: "text-red-400",
  },
  moderator: {
    name: "The Moderator",
    role: "Neutral Observer",
    color: "#f59e0b",
    avatar: "/avatars/moderator.png",
    bubbleBg: "bg-amber-500/[0.07]",
    bubbleBorder: "border-amber-500/20",
    dotColor: "bg-amber-400",
    labelColor: "text-amber-400",
  },
};

function ProgressBar({ current, max }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 mt-1 mb-6">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
        Progress
      </span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-red-500"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-400">
        {current}/{max}
      </span>
    </div>
  );
}

function MessageBubble({ msg, isActive, index }) {
  const agent = AGENTS[msg.agent];
  const isMod = msg.agent === "moderator";
  const isPro = msg.agent === "pro";

  const phaseLabel =
    msg.phase === "intro"
      ? "Opening Remarks"
      : msg.phase === "summary"
        ? "Final Summary"
        : `Round ${msg.round}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
      className={`flex ${isMod ? "justify-center" : isPro ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`relative max-w-[85%] md:max-w-[72%] rounded-2xl p-4 md:p-5 border backdrop-blur-sm
          ${agent.bubbleBg} ${agent.bubbleBorder} ${isMod ? "text-center" : ""}`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 mb-2 ${isMod ? "justify-center" : ""}`}
        >
          <span className={`w-2 h-2 rounded-full ${agent.dotColor}`} />
          <span className={`text-xs font-semibold ${agent.labelColor}`}>
            {agent.name}
          </span>
          <span className="text-[10px] text-slate-500">{phaseLabel}</span>
        </div>

        {/* Content */}
        <p
          className={`text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap ${isActive ? "typing-cursor" : ""}`}
        >
          {msg.content}
        </p>
      </div>
    </motion.div>
  );
}

export default function DebateArena({ debate }) {
  const {
    messages,
    currentAgent,
    currentRound,
    maxRounds,
    topic,
    status,
    error,
    reset,
  } = debate;

  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
      {/* Topic banner */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-block px-5 py-2 rounded-full glass">
          <span className="text-slate-500 text-sm">Topic </span>
          <span className="font-medium text-sm">{topic}</span>
        </div>
      </motion.div>

      {/* Avatars + VS */}
      <div className="flex items-center justify-between md:justify-center md:gap-16 mb-6">
        <AgentAvatar
          agent={AGENTS.pro}
          isSpeaking={currentAgent === "pro"}
          side="left"
        />

        <motion.div
          className="font-display text-3xl md:text-4xl font-black vs-glow select-none"
          animate={
            currentAgent
              ? { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }
              : { scale: 1, opacity: 0.6 }
          }
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          VS
        </motion.div>

        <AgentAvatar
          agent={AGENTS.con}
          isSpeaking={currentAgent === "con"}
          side="right"
        />
      </div>

      {/* Progress */}
      <ProgressBar current={currentRound} max={maxRounds} />

      {/* Messages feed */}
      <div className="space-y-4 min-h-[200px]">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              msg={msg}
              index={idx}
              isActive={idx === messages.length - 1 && currentAgent !== null}
            />
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      {/* Waiting indicator */}
      {currentAgent && (
        <motion.div
          className="flex justify-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass text-xs text-slate-400">
            <motion.span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: AGENTS[currentAgent]?.color }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            {AGENTS[currentAgent]?.name} is speaking…
          </div>
        </motion.div>
      )}

      {/* Complete / Error states */}
      {status === "complete" && (
        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-slate-400 mb-4">Debate concluded</p>
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl glass hover:bg-white/[0.06] transition-colors
                       font-display font-semibold cursor-pointer"
          >
            Start New Debate
          </button>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="inline-block px-5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <br />
          <button
            onClick={reset}
            className="mt-2 px-6 py-3 rounded-xl glass hover:bg-white/[0.06] transition-colors
                       font-display font-semibold cursor-pointer"
          >
            Try Again
          </button>
        </motion.div>
      )}
    </div>
  );
}
