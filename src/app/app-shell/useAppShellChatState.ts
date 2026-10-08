import { useState } from 'react'
import type { ArchivedChat, ChatData } from '../desktop/types'

export function useAppShellChatState() {
  const [archivedChats, setArchivedChats] = useState<ArchivedChat[]>([])
  const [liveChatData, setLiveChatData] = useState<ChatData | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [historyCompactions, setHistoryCompactions] = useState(0)
  const [queryDeferred, setQueryDeferred] = useState(false)

  return {
    archivedChats,
    historyCompactions,
    liveChatData,
    queryDeferred,
    refreshKey,
    setArchivedChats,
    setHistoryCompactions,
    setLiveChatData,
    setQueryDeferred,
    setRefreshKey,
  }
}
