import { useQuery } from "@tanstack/react-query";
import type { InboxThread } from "../desktop/types";
import { desktopQueryKeys, getInboxThreadsQuery } from "../query/desktop-query";

export function useDesktopInbox() {
  const query = useQuery<InboxThread[]>({
    queryKey: desktopQueryKeys.inboxThreads(),
    queryFn: getInboxThreadsQuery,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return query.data ?? [];
}
