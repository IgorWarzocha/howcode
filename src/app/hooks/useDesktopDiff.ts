import { useQuery } from "@tanstack/react-query";
import type { ProjectDiffResult } from "../desktop/types";
import { desktopQueryKeys, getProjectDiffQuery } from "../query/desktop-query";

type DiffState = {
  diff: ProjectDiffResult | null;
  isLoading: boolean;
  error: string | null;
};

export function useDesktopDiff(projectId: string | null, enabled = true) {
  const query = useQuery<ProjectDiffResult | null, Error>({
    queryKey: projectId
      ? desktopQueryKeys.projectDiff(projectId)
      : ["desktop", "projectDiff", null],
    queryFn: () => (projectId ? getProjectDiffQuery(projectId) : Promise.resolve(null)),
    enabled: enabled && Boolean(projectId),
    refetchOnMount: "always",
  });

  return {
    diff: query.data ?? null,
    isLoading: query.isLoading || query.isFetching,
    error: query.error?.message ?? null,
  } satisfies DiffState;
}
