import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentAvatar from "./AgentAvatar";

/* Default visual config per agent slot — overridden with server metadata */
const AGENT_STYLE = {
  pro: {
    color: "#3b82f6",
    avatar: "/avatars/pro.png",
    bubbleBg: "bg-blue-500/[0.07]",
    bubbleBorder: "border-blue-500/20",
    dotColor: "bg-blue-400",
    labelColor: "text-blue-400",
  },
  con: {
    color: "#ef4444",
    avatar: "/avatars/con.png",
    bubbleBg: "bg-red-500/[0.07]",
    bubbleBorder: "border-red-500/20",
    dotColor: "bg-red-400",
    labelColor: "text-red-400",
  },
  moderator: {
    color: "#f59e0b",
    avatar: "/avatars/moderator.png",
    bubbleBg: "bg-amber-500/[0.07]",
    bubbleBorder: "border-amber-500/20",
    dotColor: "bg-amber-400",
    labelColor: "text-amber-400",
  },
};

function agentDisplay(slot, serverAgents) {
  const style = AGENT_STYLE[slot];
  const meta = serverAgents?.[slot] || {};
  return {
    name: meta.name || style.name || slot,
    role: meta.role || "",
    isHuman: meta.is_human || false,
    avatar: meta.is_human ? "/avatars/human.png" : style.avatar,
    ...style,
  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

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

function MessageBubble({ msg, agentInfo, isActive }) {
  const style = AGENT_STYLE[msg.agent] || AGENT_STYLE.moderator;
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
          ${style.bubbleBg} ${style.bubbleBorder} ${isMod ? "text-center" : ""}`}
      >
        <div
          className={`flex items-center gap-2 mb-2 ${isMod ? "justify-center" : ""}`}
        >
          <span className={`w-2 h-2 rounded-full ${style.dotColor}`} />
          <span className={`text-xs font-semibold ${style.labelColor}`}>
            {agentInfo?.name || msg.agent}
          </span>
          <span className="text-[10px] text-slate-500">{phaseLabel}</span>
        </div>
        <p
          className={`text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap ${isActive ? "typing-cursor" : ""}`}
        >
          {msg.content}
        </p>
      </div>
    </motion.div>
  );
}

function HumanInput({ agent, round, onSubmit, guardrailWarning }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const t = text.trim();
    if (t) {
      onSubmit(t);
      setText("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6"
    >
      <div className="glass rounded-2xl p-5 border border-indigo-500/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-semibold text-indigo-400">
            Your Turn — Round {round}
          </span>
          <span className="text-[10px] text-slate-500">
            Argue {agent === "pro" ? "FOR" : "AGAINST"} the topic
          </span>
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type your argument… (Enter to submit)"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-sm text-white
                     placeholder-slate-500 focus:outline-none focus:border-indigo-500/40
                     resize-none h-28 transition-all"
        />
        {guardrailWarning && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{guardrailWarning} Please revise your message.</p>
          </div>
        )}
        <div className="flex justify-end mt-3">
          <motion.button
            onClick={handleSubmit}
            disabled={!text.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer
                       bg-gradient-to-r from-indigo-600 to-purple-600
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Submit Argument
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DebateArena({ debate, onReset }) {
  const {
    messages,
    currentAgent,
    currentRound,
    maxRounds,
    topic,
    status,
    error,
    isHumanTurn,
    humanTurnAgent,
    guardrailMessage,
    agents: serverAgents,
    sendHumanResponse,
  } = debate;

  const proInfo = agentDisplay("pro", serverAgents);
  const conInfo = agentDisplay("con", serverAgents);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isHumanTurn]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
      {/* Topic banner + voice indicator */}
      <motion.div
        className="flex items-center justify-center gap-3 mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-block px-5 py-2 rounded-full glass">
          <span className="text-slate-500 text-sm">Topic </span>
          <span className="font-medium text-sm">{topic}</span>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border
            bg-purple-500/15 border-purple-500/40 text-purple-300"
        >
          <VoiceOnIcon />
          Voice
          {currentAgent && (
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 ml-1"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            />
          )}
        </div>
      </motion.div>

      {/* Avatars + VS */}
      <div className="flex items-center justify-between md:justify-center md:gap-16 mb-6">
        <AgentAvatar
          agent={proInfo}
          isSpeaking={currentAgent === "pro"}
          side="left"
        />
        <motion.div
          className="font-display text-3xl md:text-4xl font-black vs-glow select-none"
          animate={
            currentAgent || isHumanTurn
              ? { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }
              : { scale: 1, opacity: 0.6 }
          }
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          VS
        </motion.div>
        <AgentAvatar
          agent={conInfo}
          isSpeaking={currentAgent === "con"}
          side="right"
        />
      </div>

      <ProgressBar current={currentRound} max={maxRounds} />

      {/* Messages feed */}
      <div className="space-y-4 min-h-[200px]">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              msg={msg}
              agentInfo={
                msg.agent === "pro"
                  ? proInfo
                  : msg.agent === "con"
                    ? conInfo
                    : agentDisplay("moderator", serverAgents)
              }
              isActive={idx === messages.length - 1 && currentAgent !== null}
            />
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      {/* Human input */}
      {isHumanTurn && (
        <HumanInput
          agent={humanTurnAgent}
          round={currentRound}
          onSubmit={sendHumanResponse}
          guardrailWarning={guardrailMessage}
        />
      )}

      {/* AI speaking indicator */}
      {currentAgent && !isHumanTurn && (
        <motion.div
          className="flex justify-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass text-xs text-slate-400">
            <motion.span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: AGENT_STYLE[currentAgent]?.color }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            {(currentAgent === "pro" ? proInfo : currentAgent === "con" ? conInfo : agentDisplay("moderator", serverAgents)).name} is speaking…
          </div>
        </motion.div>
      )}

      {/* Complete */}
      {status === "complete" && (
        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-slate-400 mb-4">Debate concluded</p>
          <button
            onClick={onReset}
            className="px-6 py-3 rounded-xl glass hover:bg-white/[0.06] transition-colors font-display font-semibold cursor-pointer"
          >
            Start New Debate
          </button>
        </motion.div>
      )}

      {/* Error */}
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
            onClick={onReset}
            className="mt-2 px-6 py-3 rounded-xl glass hover:bg-white/[0.06] transition-colors font-display font-semibold cursor-pointer"
          >
            Try Again
          </button>
        </motion.div>
      )}
    </div>
  );
}

function VoiceOnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}
