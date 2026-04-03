import { useQuery } from "@tanstack/react-query";
import type { ThreadData } from "../desktop/types";
import { desktopQueryKeys, getThreadQuery } from "../query/desktop-query";

export function useDesktopThread(
  sessionPath: string | null | undefined,
  refreshKey = 0,
  includeHistory = false,
) {
  const query = useQuery<ThreadData | null>({
    queryKey: sessionPath
      ? desktopQueryKeys.threadWithHistory(sessionPath, refreshKey, includeHistory)
      : ["desktop", "thread", null, refreshKey, includeHistory],
    queryFn: () =>
      sessionPath ? getThreadQuery(sessionPath, includeHistory) : Promise.resolve(null),
    enabled: Boolean(sessionPath),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? null;
}
