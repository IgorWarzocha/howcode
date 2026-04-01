import { useEffect, useState } from "react";
import type { ShellState } from "../desktop/types";

export function useDesktopShell() {
  const [shellState, setShellState] = useState<ShellState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadShellState = async () => {
      try {
        const nextState = await window.piDesktop?.getShellState();
        if (!cancelled && nextState) {
          setShellState(nextState);
        }
      } catch {
        if (!cancelled) {
          setShellState(null);
        }
      }
    };

    void loadShellState();

    return () => {
      cancelled = true;
    };
  }, []);

  return shellState;
}
