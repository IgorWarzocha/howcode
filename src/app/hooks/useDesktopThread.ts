import { useQuery } from "@tanstack/react-query";
import type { ThreadData } from "../desktop/types";
import { desktopQueryKeys, getThreadQuery } from "../query/desktop-query";

export function useDesktopThread(
  sessionPath: string | null | undefined,
  refreshKey = 0,
  historyCompactions = 0,
) {
  const query = useQuery<ThreadData | null>({
    queryKey: sessionPath
      ? desktopQueryKeys.thread(sessionPath, refreshKey, historyCompactions)
      : ["desktop", "thread", null, refreshKey, historyCompactions],
    queryFn: () =>
      sessionPath ? getThreadQuery(sessionPath, historyCompactions) : Promise.resolve(null),
    enabled: Boolean(sessionPath),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? null;
}
