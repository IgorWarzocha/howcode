import { useEffect, useState } from "react";
import type { TurnDiffResult } from "../desktop/types";

type DiffState = {
  diff: TurnDiffResult | null;
  isLoading: boolean;
  error: string | null;
};

const idleState: DiffState = {
  diff: null,
  isLoading: false,
  error: null,
};

export function useDesktopDiff(
  sessionPath: string | null,
  checkpointTurnCount: number | null,
  enabled = true,
) {
  const [state, setState] = useState<DiffState>(idleState);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !sessionPath) {
      setState(idleState);
      return;
    }

    setState((current) => ({
      diff: current.diff,
      isLoading: true,
      error: null,
    }));

    const loadDiff = async () => {
      try {
        const nextDiff =
          checkpointTurnCount === null
            ? await window.piDesktop?.getFullThreadDiff?.(sessionPath)
            : await window.piDesktop?.getTurnDiff?.(sessionPath, checkpointTurnCount);

        if (!cancelled) {
          setState({
            diff: nextDiff ?? null,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            diff: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to load diff.",
          });
        }
      }
    };

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [checkpointTurnCount, enabled, sessionPath]);

  return state;
}
