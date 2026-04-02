import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TurnDiffResult } from "../desktop/types";
import { desktopQueryKeys, getThreadDiffQuery } from "../query/desktop-query";

type DiffState = {
  diff: TurnDiffResult | null;
  isLoading: boolean;
  error: string | null;
};

export function useDesktopDiff(
  sessionPath: string | null,
  checkpointTurnCount: number | null,
  enabled = true,
) {
  const query = useQuery<TurnDiffResult | null, Error>({
    queryKey: sessionPath
      ? desktopQueryKeys.diff(sessionPath, checkpointTurnCount)
      : ["desktop", "diff", null, checkpointTurnCount],
    queryFn: () =>
      sessionPath ? getThreadDiffQuery(sessionPath, checkpointTurnCount) : Promise.resolve(null),
    enabled: enabled && Boolean(sessionPath),
    placeholderData: keepPreviousData,
  });

  return {
    diff: query.data ?? null,
    isLoading: query.isLoading || query.isFetching,
    error: query.error?.message ?? null,
  } satisfies DiffState;
}
