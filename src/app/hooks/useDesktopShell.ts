import { useCallback, useEffect, useState } from "react";
import type { ArchivedThread, ShellState, Thread } from "../desktop/types";

export function useDesktopShell() {
  const [shellState, setShellState] = useState<ShellState | null>(null);

  const refreshShellState = useCallback(async () => {
    try {
      const nextState = await window.piDesktop?.getShellState();
      if (nextState) {
        setShellState(nextState);
      }
    } catch {
      setShellState(null);
    }
  }, []);

  const loadProjectThreads = useCallback(async (projectId: string) => {
    if (!window.piDesktop?.getProjectThreads) {
      return [] as Thread[];
    }

    const threads = await window.piDesktop.getProjectThreads(projectId);
    setShellState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        projects: currentState.projects.map((project) =>
          project.id === projectId
            ? { ...project, threads, threadCount: threads.length, threadsLoaded: true }
            : project,
        ),
      };
    });

    return threads;
  }, []);

  const loadArchivedThreads = useCallback(async () => {
    if (!window.piDesktop?.getArchivedThreads) {
      return [] as ArchivedThread[];
    }

    return window.piDesktop.getArchivedThreads();
  }, []);

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

  return {
    shellState,
    refreshShellState,
    loadProjectThreads,
    loadArchivedThreads,
  };
}
