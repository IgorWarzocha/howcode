import { useQuery } from "@tanstack/react-query";
import type { ThreadData } from "../desktop/types";
import { desktopQueryKeys, getThreadQuery } from "../query/desktop-query";

export function useDesktopThread(sessionPath: string | null | undefined, refreshKey = 0) {
  const query = useQuery<ThreadData | null>({
    queryKey: sessionPath
      ? desktopQueryKeys.thread(sessionPath, refreshKey)
      : ["desktop", "thread", null, refreshKey],
    queryFn: () => (sessionPath ? getThreadQuery(sessionPath) : Promise.resolve(null)),
    enabled: Boolean(sessionPath),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? null;
}
