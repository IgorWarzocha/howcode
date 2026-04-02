import { useEffect, useState } from "react";
import type { ThreadData } from "../desktop/types";

export function useDesktopThread(sessionPath: string | null | undefined) {
  const [threadData, setThreadData] = useState<ThreadData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadThread = async () => {
      if (!sessionPath || !window.piDesktop?.getThread) {
        setThreadData(null);
        return;
      }

      try {
        const nextThread = await window.piDesktop.getThread(sessionPath);
        if (!cancelled) {
          setThreadData(nextThread);
        }
      } catch {
        if (!cancelled) {
          setThreadData(null);
        }
      }
    };

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [sessionPath]);

  return threadData;
}
