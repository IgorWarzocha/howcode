import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type Dispatch, type SetStateAction, useCallback } from 'react'
import {
  createWorkspaceQuery,
  desktopQueryKeys,
  getWorkspaceNavigationStateQuery,
} from '../query/desktop-query'
import type { WorkspaceAction } from '../state/workspace-model'

type WorkspaceNavigationState = Awaited<ReturnType<typeof getWorkspaceNavigationStateQuery>>

const sidebarQueryOptions = {
  queryKey: desktopQueryKeys.workspaceNavigationState(),
  queryFn: () => getWorkspaceNavigationStateQuery(),
}

export function useAppShellWorkspaceNavigation({
  dispatch,
  selectedWorkspaceId,
}: {
  dispatch: Dispatch<WorkspaceAction>
  selectedWorkspaceId: string | null
}) {
  const queryClient = useQueryClient()
  const sidebarQuery = useQuery(sidebarQueryOptions)
  const setSelectedWorkspaceId = useCallback(
    (workspaceId: string | null) => {
      const workspace = sidebarQuery.data?.workspaces.find((item) => item.id === workspaceId)
      dispatch({ type: 'select-workspace', workspaceId, directoryId: workspace?.directoryId })
    },
    [dispatch, sidebarQuery.data],
  )
  const setWorkspaceNavigationState = useCallback(
    (updater: SetStateAction<WorkspaceNavigationState>) => {
      queryClient.setQueryData<WorkspaceNavigationState>(sidebarQueryOptions.queryKey, (current) =>
        typeof updater === 'function' ? updater(current ?? null) : updater,
      )
    },
    [queryClient],
  )

  const refreshWorkspaceNavigationState = useCallback(
    () => queryClient.fetchQuery(sidebarQueryOptions),
    [queryClient],
  )

  const handleCreateWorkspace = async (name: string) => {
    const nextState = await createWorkspaceQuery(name)
    setWorkspaceNavigationState(nextState)
    if (nextState?.selectedWorkspaceId) {
      dispatch({ type: 'select-workspace', workspaceId: nextState.selectedWorkspaceId })
    }
    return nextState
  }

  return {
    workspaceNavigationLoading: sidebarQuery.isLoading,
    workspaceNavigationError: sidebarQuery.error,
    workspaceNavigationState: sidebarQuery.data ?? null,
    retryWorkspaceNavigationState: sidebarQuery.refetch,
    handleCreateWorkspace,
    refreshWorkspaceNavigationState,
    selectedWorkspaceId,
    setWorkspaceNavigationState,
    setSelectedWorkspaceId,
  }
}
