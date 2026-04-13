import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPersistedSessionPath } from "../../../shared/session-paths";
import type { ThreadData } from "../desktop/types";
import { desktopQueryKeys, getThreadQuery } from "../query/desktop-query";

export function useDesktopThread(
  sessionPath: string | null | undefined,
  refreshKey = 0,
  historyCompactions = 0,
) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath);

  const query = useQuery<ThreadData | null>({
    queryKey: persistedSessionPath
      ? desktopQueryKeys.thread(persistedSessionPath, refreshKey, historyCompactions)
      : ["desktop", "thread", null, refreshKey, historyCompactions],
    queryFn: () =>
      persistedSessionPath
        ? getThreadQuery(persistedSessionPath, historyCompactions)
        : Promise.resolve(null),
    enabled: Boolean(persistedSessionPath),
    staleTime: Number.POSITIVE_INFINITY,
    placeholderData: persistedSessionPath ? keepPreviousData : undefined,
  });

  return query.data ?? null;
}
