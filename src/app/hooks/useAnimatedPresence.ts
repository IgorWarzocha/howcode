import { useEffect, useState } from "react";

const DEFAULT_EXIT_MS = 180;

export function useAnimatedPresence(open: boolean, exitMs = DEFAULT_EXIT_MS) {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setPresent(false), exitMs);
    return () => window.clearTimeout(timeoutId);
  }, [exitMs, open]);

  return open || present;
}
