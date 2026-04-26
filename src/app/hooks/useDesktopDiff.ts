import { useQuery } from "@tanstack/react-query";
import { cleanUserErrorMessage } from "../desktop/error-messages";
import type { ProjectDiffBaseline, ProjectDiffResult } from "../desktop/types";
import { desktopQueryKeys, getProjectDiffQuery } from "../query/desktop-query";

type DiffState = {
  diff: ProjectDiffResult | null;
  isLoading: boolean;
  error: string | null;
};

export function getReadableDesktopDiffError(error: string | null) {
  return error ? cleanUserErrorMessage(error, "Could not load diff.") : null;
}

export function useDesktopDiff(
  projectId: string | null,
  baseline: ProjectDiffBaseline | null = null,
  enabled = true,
) {
  const queryEnabled = enabled && Boolean(projectId);
  const query = useQuery<ProjectDiffResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiff(projectId, baseline)
      : ["desktop", "projectDiff", null],
    queryFn: () => (projectId ? getProjectDiffQuery(projectId, baseline) : Promise.resolve(null)),
    enabled: queryEnabled,
    refetchOnMount: "always",
  });

  return {
    diff: query.data ?? null,
    isLoading: query.isLoading || query.isFetching,
    error: queryEnabled ? getReadableDesktopDiffError(query.error?.message ?? null) : null,
  } satisfies DiffState;
}
