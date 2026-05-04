import { useEffect, useRef } from "react";
import type { ProjectGitState, TerminalSessionSnapshot } from "../desktop/types";
import { listDesktopTerminals, subscribeDesktopTerminal } from "../hooks/useDesktopTerminal";

type UseTerminalGitStateSyncInput = {
  composerProjectId: string;
  loadProjectGitState: (projectId: string) => Promise<ProjectGitState | null>;
  setProjectGitState: (state: ProjectGitState | null) => void;
};

type TrackedTerminalSession = {
  projectId: string;
};

const gitRefreshDelayMs = 900;

function shouldTrackTerminal(snapshot: TerminalSessionSnapshot) {
  return snapshot.status === "starting" || snapshot.status === "running";
}

export function useTerminalGitStateSync({
  composerProjectId,
  loadProjectGitState,
  setProjectGitState,
}: UseTerminalGitStateSyncInput) {
  const stateRef = useRef({ composerProjectId, loadProjectGitState, setProjectGitState });
  const terminalSessionsByIdRef = useRef(new Map<string, TrackedTerminalSession>());
  const refreshTimersByProjectIdRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    stateRef.current = { composerProjectId, loadProjectGitState, setProjectGitState };
  }, [composerProjectId, loadProjectGitState, setProjectGitState]);

  useEffect(() => {
    const rememberSnapshot = (snapshot: TerminalSessionSnapshot) => {
      if (!shouldTrackTerminal(snapshot)) {
        terminalSessionsByIdRef.current.delete(snapshot.sessionId);
        return;
      }

      terminalSessionsByIdRef.current.set(snapshot.sessionId, {
        projectId: snapshot.projectId,
      });
    };

    const scheduleRefresh = (projectId: string | null | undefined) => {
      if (!projectId || projectId !== stateRef.current.composerProjectId) {
        return;
      }

      const existingTimer = refreshTimersByProjectIdRef.current.get(projectId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        refreshTimersByProjectIdRef.current.delete(projectId);
        void stateRef.current.loadProjectGitState(projectId).then((nextProjectGitState) => {
          if (projectId === stateRef.current.composerProjectId) {
            stateRef.current.setProjectGitState(nextProjectGitState);
          }
        });
      }, gitRefreshDelayMs);

      refreshTimersByProjectIdRef.current.set(projectId, timer);
    };

    void listDesktopTerminals().then((snapshots) => {
      for (const snapshot of snapshots) {
        rememberSnapshot(snapshot);
      }
    });

    const unsubscribe = subscribeDesktopTerminal((event) => {
      if (event.type === "started" || event.type === "restarted" || event.type === "updated") {
        rememberSnapshot(event.snapshot);
        scheduleRefresh(event.snapshot.projectId);
        return;
      }

      const trackedSession = terminalSessionsByIdRef.current.get(event.sessionId);
      if (!trackedSession) {
        return;
      }

      if (event.type === "output") {
        // TUI-driven agent sessions and shell commands can change branches without producing a
        // desktop thread end event. Debounce output-driven refreshes so the footer branch chip and
        // git-ops state converge while the terminal remains open.
        scheduleRefresh(trackedSession.projectId);
        return;
      }

      if (event.type === "exited" || event.type === "error" || event.type === "cleared") {
        terminalSessionsByIdRef.current.delete(event.sessionId);
        scheduleRefresh(trackedSession.projectId);
      }
    });

    return () => {
      unsubscribe();
      for (const timer of refreshTimersByProjectIdRef.current.values()) {
        clearTimeout(timer);
      }
      refreshTimersByProjectIdRef.current.clear();
      terminalSessionsByIdRef.current.clear();
    };
  }, []);
}
