import { Debouncer } from "@tanstack/react-pacer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import type {
  ArchivedThread,
  ComposerAttachment,
  ComposerState,
  ComposerStateRequest,
  ProjectGitState,
  ShellState,
  Thread,
} from "../desktop/types";
import {
  desktopQueryKeys,
  getArchivedThreadsQuery,
  getComposerStateQuery,
  getProjectGitStateQuery,
  getProjectThreadsQuery,
  getShellStateQuery,
  pickComposerAttachmentsQuery,
} from "../query/desktop-query";

export function useDesktopShell() {
  const queryClient = useQueryClient();
  const shellStateQuery = useQuery<ShellState | null>({
    queryKey: desktopQueryKeys.shellState(),
    queryFn: getShellStateQuery,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const shellRefreshDebouncer = useMemo(
    () =>
      new Debouncer(
        () => {
          void queryClient.invalidateQueries({ queryKey: desktopQueryKeys.shellState() });
        },
        { wait: 140 },
      ),
    [queryClient],
  );

  const refreshShellState = useCallback(async () => {
    const nextState = await queryClient.fetchQuery({
      queryKey: desktopQueryKeys.shellState(),
      queryFn: getShellStateQuery,
      staleTime: 0,
    });

    return nextState;
  }, [queryClient]);

  const scheduleShellStateRefresh = useCallback(() => {
    shellRefreshDebouncer.maybeExecute();
  }, [shellRefreshDebouncer]);

  const loadProjectThreads = useCallback(
    async (projectId: string) => {
      const threads = await queryClient.fetchQuery({
        queryKey: desktopQueryKeys.projectThreads(projectId),
        queryFn: () => getProjectThreadsQuery(projectId),
        staleTime: 0,
      });

      queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) => {
        if (!currentState) {
          return currentState ?? null;
        }

        return {
          ...currentState,
          projects: currentState.projects.map((project) =>
            project.id === projectId
              ? { ...project, threads, threadCount: threads.length, threadsLoaded: true }
              : project,
          ),
        };
      });

      return threads;
    },
    [queryClient],
  );

  const applyProjectOrder = useCallback(
    (projectIds: string[]) => {
      queryClient.setQueryData<ShellState | null>(desktopQueryKeys.shellState(), (currentState) => {
        if (!currentState) {
          return currentState ?? null;
        }

        const orderIndexById = new Map(projectIds.map((projectId, index) => [projectId, index]));

        return {
          ...currentState,
          projects: [...currentState.projects].sort((left, right) => {
            const leftIndex = orderIndexById.get(left.id);
            const rightIndex = orderIndexById.get(right.id);

            if (leftIndex !== undefined && rightIndex !== undefined) {
              return leftIndex - rightIndex;
            }

            if (leftIndex !== undefined) {
              return -1;
            }

            if (rightIndex !== undefined) {
              return 1;
            }

            return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
          }),
        };
      });
    },
    [queryClient],
  );

  const loadArchivedThreads = useCallback(async () => {
    return queryClient.fetchQuery({
      queryKey: desktopQueryKeys.archivedThreads(),
      queryFn: getArchivedThreadsQuery,
      staleTime: 0,
    }) as Promise<ArchivedThread[]>;
  }, [queryClient]);

  const loadComposerState = useCallback(
    async (request: ComposerStateRequest = {}) => {
      return queryClient.fetchQuery({
        queryKey: desktopQueryKeys.composerState(request),
        queryFn: () => getComposerStateQuery(request),
        staleTime: 0,
      }) as Promise<ComposerState | null>;
    },
    [queryClient],
  );

  const loadProjectGitState = useCallback(
    async (projectId: string) => {
      return queryClient.fetchQuery({
        queryKey: desktopQueryKeys.projectGitState(projectId),
        queryFn: () => getProjectGitStateQuery(projectId),
        staleTime: 0,
      }) as Promise<ProjectGitState | null>;
    },
    [queryClient],
  );

  const pickComposerAttachments = useCallback(async (projectId?: string | null) => {
    return pickComposerAttachmentsQuery(projectId ?? null) as Promise<ComposerAttachment[]>;
  }, []);

  useEffect(() => {
    return () => {
      shellRefreshDebouncer.cancel();
    };
  }, [shellRefreshDebouncer]);

  return {
    shellState: shellStateQuery.data ?? null,
    refreshShellState,
    scheduleShellStateRefresh,
    loadProjectThreads,
    applyProjectOrder,
    loadArchivedThreads,
    loadComposerState,
    loadProjectGitState,
    pickComposerAttachments,
  };
}
