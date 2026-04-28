import { useEffect, useMemo, useRef, useState } from "react";
import type { TerminalSessionSnapshot } from "../desktop/types";
import { listDesktopTerminals, subscribeDesktopTerminal } from "../hooks/useDesktopTerminal";

type RunningTerminalSession = {
  projectId: string;
  sessionPath: string | null;
};

function isRunningShellSnapshot(snapshot: TerminalSessionSnapshot) {
  return (
    snapshot.launchMode === "shell" &&
    (snapshot.status === "starting" || snapshot.status === "running")
  );
}

function shouldShowTerminalSnapshot(
  snapshot: TerminalSessionSnapshot,
  openedInThisSession = false,
) {
  return isRunningShellSnapshot(snapshot) && (openedInThisSession || snapshot.hasVisibleContent);
}

export function useRunningTerminalSessions() {
  const terminalEventTouchedSessionIdsRef = useRef(new Set<string>());
  const [runningTerminalSessionsById, setRunningTerminalSessionsById] = useState<
    Record<string, RunningTerminalSession>
  >({});

  useEffect(() => {
    const applySnapshots = (snapshots: TerminalSessionSnapshot[]) => {
      const touchedSessionIds = terminalEventTouchedSessionIdsRef.current;

      setRunningTerminalSessionsById((current) => ({
        ...current,
        ...Object.fromEntries(
          snapshots
            .filter(
              (snapshot) =>
                !touchedSessionIds.has(snapshot.sessionId) && shouldShowTerminalSnapshot(snapshot),
            )
            .map((snapshot) => [
              snapshot.sessionId,
              {
                projectId: snapshot.projectId,
                sessionPath: snapshot.sessionPath,
              },
            ]),
        ),
      }));
    };

    void listDesktopTerminals().then((snapshots) => {
      applySnapshots(snapshots);
    });

    return subscribeDesktopTerminal((event) => {
      terminalEventTouchedSessionIdsRef.current.add(event.sessionId);

      if (event.type === "started" || event.type === "restarted") {
        if (event.snapshot.launchMode !== "shell") {
          return;
        }

        setRunningTerminalSessionsById((current) => ({
          ...current,
          [event.sessionId]: {
            projectId: event.snapshot.projectId,
            sessionPath: event.snapshot.sessionPath,
          },
        }));
        return;
      }

      if (event.type === "updated") {
        if (!shouldShowTerminalSnapshot(event.snapshot)) {
          setRunningTerminalSessionsById((current) => {
            if (!(event.sessionId in current)) {
              return current;
            }

            const next = { ...current };
            delete next[event.sessionId];
            return next;
          });
          return;
        }

        setRunningTerminalSessionsById((current) => ({
          ...current,
          [event.sessionId]: {
            projectId: event.snapshot.projectId,
            sessionPath: event.snapshot.sessionPath,
          },
        }));
        return;
      }

      if (event.type === "cleared" || event.type === "exited" || event.type === "error") {
        setRunningTerminalSessionsById((current) => {
          if (!(event.sessionId in current)) {
            return current;
          }

          const next = { ...current };
          delete next[event.sessionId];
          return next;
        });
      }
    });
  }, []);

  const terminalRunningSessionPaths = useMemo(
    () =>
      new Set(
        Object.values(runningTerminalSessionsById)
          .map((session) => session.sessionPath)
          .filter((sessionPath): sessionPath is string => typeof sessionPath === "string"),
      ),
    [runningTerminalSessionsById],
  );
  const terminalRunningProjectIds = useMemo(
    () => new Set(Object.values(runningTerminalSessionsById).map((session) => session.projectId)),
    [runningTerminalSessionsById],
  );

  return {
    terminalRunningProjectIds,
    terminalRunningSessionPaths,
  };
}
