import { motion } from "framer-motion";
import ParticleBackground from "./components/ParticleBackground";
import TopicInput from "./components/TopicInput";
import DebateArena from "./components/DebateArena";
import useDebateWebSocket from "./hooks/useDebateWebSocket";

export default function App() {
  const debate = useDebateWebSocket();

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050a18]">
      {/* Radial gradient overlays */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/[0.04] blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/[0.04] blur-3xl" />
      </div>

      <ParticleBackground />

      <div className="relative z-10">
        {/* Header */}
        <header className="pt-10 pb-8 md:pt-14 md:pb-10 text-center">
          <motion.h1
            className="font-display text-4xl md:text-6xl font-extrabold tracking-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Multi-Agent Debate
            </span>
          </motion.h1>

          <motion.p
            className="mt-3 text-slate-400 text-sm md:text-base max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Watch AI agents argue from opposing perspectives, orchestrated by
            LangGraph
          </motion.p>

          {/* Architecture badges */}
          <motion.div
            className="flex justify-center gap-3 mt-5 flex-wrap px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {["LangGraph", "Multi-Agent", "Real-time Streaming"].map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </header>

        {/* Main content */}
        {debate.status === "idle" ? (
          <TopicInput onStart={debate.startDebate} />
        ) : (
          <DebateArena debate={debate} />
        )}

        {/* Footer */}
        <footer className="text-center py-10 text-slate-600 text-xs">
          Built with LangGraph + FastAPI + React
        </footer>
      </div>
    </div>
  );
}
