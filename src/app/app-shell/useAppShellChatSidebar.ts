import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type SetStateAction, useCallback, useState } from 'react'
import {
  createChatGroupQuery,
  desktopQueryKeys,
  getChatSidebarStateQuery,
} from '../query/desktop-query'

type ChatSidebarState = Awaited<ReturnType<typeof getChatSidebarStateQuery>>

const sidebarQueryOptions = {
  queryKey: desktopQueryKeys.chatSidebarState(),
  queryFn: () => getChatSidebarStateQuery(),
}

export function useAppShellChatSidebar() {
  const [selectedChatGroupId, setSelectedChatGroupId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const sidebarQuery = useQuery(sidebarQueryOptions)
  const setChatSidebarState = useCallback(
    (updater: SetStateAction<ChatSidebarState>) => {
      queryClient.setQueryData<ChatSidebarState>(sidebarQueryOptions.queryKey, (current) =>
        typeof updater === 'function' ? updater(current ?? null) : updater,
      )
    },
    [queryClient],
  )

  const refreshChatSidebarState = useCallback(
    () => queryClient.fetchQuery(sidebarQueryOptions),
    [queryClient],
  )

  const handleCreateChatGroup = async (name: string) => {
    const nextState = await createChatGroupQuery(name)
    setChatSidebarState(nextState)
    if (nextState?.selectedGroupId) setSelectedChatGroupId(nextState.selectedGroupId)
    return nextState
  }

  return {
    chatSidebarLoading: sidebarQuery.isLoading,
    chatSidebarState: sidebarQuery.data ?? null,
    handleCreateChatGroup,
    refreshChatSidebarState,
    selectedChatGroupId,
    setChatSidebarState,
    setSelectedChatGroupId,
  }
}
