// Server-side TTS is now handled by the backend via macOS `say`.
// This hook is kept as a thin placeholder so the UI toggle still works
// without breaking any imports.

import { useCallback, useState } from "react";

export default function useSpeech() {
  const [enabled, setEnabled] = useState(true);

  const toggle = useCallback(() => setEnabled((p) => !p), []);
  const cancel = useCallback(() => {}, []);
  const speak = useCallback(() => {}, []);

  return { enabled, isSpeaking: false, speak, cancel, toggle };
}
