import { useCallback, useEffect, useState } from 'react'
import { useComposerPopoverDismissSignal } from './composer-popover-coordination'

export function useComposerSessionTreePanel(input: {
  sessionPath: string | null
  slashCommandsOpen: boolean
}) {
  const [sessionTreeOpen, setSessionTreeOpen] = useState(false)
  const persistedPath = input.sessionPath?.trim() ?? ''

  const dismissSessionTree = useCallback(() => {
    setSessionTreeOpen(false)
  }, [])

  const openSessionTree = useCallback(() => {
    if (!persistedPath) return
    setSessionTreeOpen(true)
  }, [persistedPath])

  useComposerPopoverDismissSignal({
    onDismiss: () => {
      dismissSessionTree()
    },
  })

  useEffect(() => {
    if (!input.slashCommandsOpen) return
    dismissSessionTree()
  }, [dismissSessionTree, input.slashCommandsOpen])

  useEffect(() => {
    if (!persistedPath) dismissSessionTree()
  }, [dismissSessionTree, persistedPath])

  return {
    dismissSessionTree,
    openSessionTree,
    sessionTreeOpen,
    setSessionTreeOpen,
  }
}
