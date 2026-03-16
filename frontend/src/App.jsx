import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "./components/ParticleBackground";
import ModeSelector from "./components/ModeSelector";
import DebateSetup from "./components/DebateSetup";
import DebateArena from "./components/DebateArena";
import useDebateWebSocket from "./hooks/useDebateWebSocket";

export default function App() {
  const [step, setStep] = useState("mode"); // mode | setup | debate
  const [mode, setMode] = useState(null);
  const debate = useDebateWebSocket();

  const handleModeSelect = (m) => {
    setMode(m);
    setStep("setup");
  };

  const handleStart = (payload) => {
    setStep("debate");
    debate.startDebate(payload);
  };

  const handleReset = () => {
    debate.reset();
    setStep("mode");
    setMode(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050a18]">
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
            AI agents argue from opposing perspectives, orchestrated by
            LangGraph
          </motion.p>

          <motion.div
            className="flex justify-center gap-3 mt-5 flex-wrap px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {["LangGraph", "Multi-Agent", "Real-time Streaming", "Multi-Provider"].map(
              (tag) => (
                <span
                  key={tag}
                  className="text-[11px] px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-slate-400"
                >
                  {tag}
                </span>
              ),
            )}
          </motion.div>
        </header>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === "mode" && (
            <motion.div
              key="mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <ModeSelector onSelect={handleModeSelect} />
            </motion.div>
          )}

          {step === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <DebateSetup
                mode={mode}
                onStart={handleStart}
                onBack={() => setStep("mode")}
              />
            </motion.div>
          )}

          {step === "debate" && (
            <motion.div
              key="debate"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DebateArena debate={debate} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="text-center py-10 text-slate-600 text-xs space-y-1">
          <p>&copy; 2026 Kunal Kamdar. All Rights Reserved.</p>
          <p>Proprietary software — private use only. Not licensed for distribution.</p>
        </footer>
      </div>
    </div>
  );
}
