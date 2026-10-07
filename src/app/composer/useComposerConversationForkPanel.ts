import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import { useCallback, useEffect, useState } from 'react'
import { useComposerPopoverDismissSignal } from './composer-popover-coordination'

export function useComposerConversationForkPanel(input: {
  conversationId: string | null
  slashCommandsOpen: boolean
}) {
  const [conversationForkOpen, setConversationForkOpen] = useState(false)
  const persistedPath = getPersistedConversationId(input.conversationId) ?? ''

  const dismissConversationFork = useCallback(() => setConversationForkOpen(false), [])

  const openConversationFork = useCallback(() => {
    if (!persistedPath) return
    setConversationForkOpen(true)
  }, [persistedPath])

  useComposerPopoverDismissSignal({
    onDismiss: () => {
      dismissConversationFork()
    },
  })

  useEffect(() => {
    if (!input.slashCommandsOpen) return
    dismissConversationFork()
  }, [dismissConversationFork, input.slashCommandsOpen])

  useEffect(() => {
    if (!persistedPath) dismissConversationFork()
  }, [dismissConversationFork, persistedPath])

  return {
    dismissConversationFork,
    openConversationFork,
    conversationForkOpen,
    setConversationForkOpen,
  }
}
