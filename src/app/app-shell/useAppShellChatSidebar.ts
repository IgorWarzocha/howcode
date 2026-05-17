import { useCallback, useEffect, useState } from 'react'
import { createChatGroupQuery, getChatSidebarStateQuery } from '../query/desktop-query'
import type { WorkspaceState } from '../state/workspace'

type ChatSidebarState = Awaited<ReturnType<typeof getChatSidebarStateQuery>>

export function useAppShellChatSidebar(activeView: WorkspaceState['activeView']) {
  const [selectedChatGroupId, setSelectedChatGroupId] = useState<string | null>(null)
  const [chatSidebarState, setChatSidebarState] = useState<ChatSidebarState>(null)
  const [chatSidebarLoading, setChatSidebarLoading] = useState(false)

  const refreshChatSidebarState = useCallback(
    async (groupId = selectedChatGroupId) => {
      const nextState = await getChatSidebarStateQuery(groupId)
      setChatSidebarState(nextState)
      return nextState
    },
    [selectedChatGroupId],
  )

  const handleCreateChatGroup = async (name: string) => {
    const nextState = await createChatGroupQuery(name)
    setChatSidebarState(nextState)
    if (nextState?.selectedGroupId) setSelectedChatGroupId(nextState.selectedGroupId)
    return nextState
  }

  useEffect(() => {
    if (activeView !== 'chat') return
    let cancelled = false
    setChatSidebarLoading(true)

    void getChatSidebarStateQuery(selectedChatGroupId)
      .then((nextState) => {
        if (!cancelled) setChatSidebarState(nextState)
      })
      .finally(() => {
        if (!cancelled) setChatSidebarLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeView, selectedChatGroupId])

  return {
    chatSidebarLoading,
    chatSidebarState,
    handleCreateChatGroup,
    refreshChatSidebarState,
    selectedChatGroupId,
    setChatSidebarState,
    setSelectedChatGroupId,
  }
}
