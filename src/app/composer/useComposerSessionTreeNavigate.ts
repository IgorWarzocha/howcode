import type { DesktopActionPayload } from '@howcode/shared/desktop-action-contracts'
import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { desktopQueryKeys } from '../query/desktop-query-keys'
import type { View } from '../types'

export function useComposerSessionTreeNavigate(input: {
  activeView: View
  chatGroupId?: string | null | undefined
  composerIsStreaming: boolean
  extensionRunning: boolean
  isCompacting: boolean
  isSending: boolean
  projectId: string
  runComposerAction: (
    action: 'composer.session-tree.navigate' | 'composer.session-tree.label',
    payload:
      | DesktopActionPayload<'composer.session-tree.navigate'>
      | DesktopActionPayload<'composer.session-tree.label'>,
    options?: { closeMenu?: boolean },
  ) => Promise<boolean>
  sessionPath: string | null
}) {
  const {
    chatGroupId,
    composerIsStreaming,
    extensionRunning,
    isCompacting,
    isSending,
    projectId,
    runComposerAction,
    sessionPath,
  } = input
  const composerMode = input.activeView === 'chat' ? 'chat' : 'code'
  const queryClient = useQueryClient()
  const [sessionTreeHidden, setSessionTreeHidden] = useState(false)
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const sessionTreeNavigateDisabled =
    !persistedSessionPath || isSending || composerIsStreaming || extensionRunning || isCompacting

  const handleSessionTreeNavigate = useCallback(
    async (entryId: string, summarize: boolean, label?: string): Promise<boolean> => {
      if (summarize) setSessionTreeHidden(true)
      try {
        const ok = await runComposerAction(
          'composer.session-tree.navigate',
          {
            projectId,
            sessionPath,
            composerMode,
            chatGroupId,
            targetEntryId: entryId,
            summarize,
            label: label?.trim() || undefined,
          },
          { closeMenu: false },
        )
        if (!ok) return false
        if (persistedSessionPath) {
          void queryClient.invalidateQueries({
            queryKey: desktopQueryKeys.sessionTreeList(persistedSessionPath),
          })
        }
        return true
      } finally {
        setSessionTreeHidden(false)
      }
    },
    [
      chatGroupId,
      composerMode,
      persistedSessionPath,
      projectId,
      queryClient,
      runComposerAction,
      sessionPath,
    ],
  )

  const handleSessionTreeLabel = useCallback(
    async (entryId: string, label: string): Promise<boolean> => {
      const ok = await runComposerAction(
        'composer.session-tree.label',
        {
          projectId,
          sessionPath,
          composerMode,
          chatGroupId,
          targetEntryId: entryId,
          label,
        },
        { closeMenu: false },
      )
      if (!ok) return false
      if (persistedSessionPath) {
        void queryClient.invalidateQueries({
          queryKey: desktopQueryKeys.sessionTreeList(persistedSessionPath),
        })
      }
      return true
    },
    [
      chatGroupId,
      composerMode,
      persistedSessionPath,
      projectId,
      queryClient,
      runComposerAction,
      sessionPath,
    ],
  )

  useEffect(() => {
    if (!isCompacting) setSessionTreeHidden(false)
  }, [isCompacting])

  return {
    handleSessionTreeNavigate,
    handleSessionTreeLabel,
    sessionTreeForceHidden: sessionTreeHidden,
    sessionTreeNavigateDisabled,
  }
}
