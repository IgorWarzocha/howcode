import type { DesktopActionPayload } from '@howcode/shared/desktop-action-contracts'
import { getPersistedSessionPath } from '@howcode/shared/session-paths'
import { useCallback, useEffect, useState } from 'react'
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
    action: 'composer.session-tree.navigate',
    payload: DesktopActionPayload<'composer.session-tree.navigate'>,
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
  const [sessionTreeHidden, setSessionTreeHidden] = useState(false)
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const sessionTreeNavigateDisabled =
    !persistedSessionPath || isSending || composerIsStreaming || extensionRunning || isCompacting

  const handleSessionTreeNavigate = useCallback(
    async (entryId: string, summarize: boolean) => {
      setSessionTreeHidden(true)
      const ok = await runComposerAction(
        'composer.session-tree.navigate',
        {
          projectId,
          sessionPath,
          composerMode,
          chatGroupId,
          targetEntryId: entryId,
          summarize,
        },
        { closeMenu: false },
      )
      if (!ok) setSessionTreeHidden(false)
    },
    [chatGroupId, composerMode, projectId, runComposerAction, sessionPath],
  )

  useEffect(() => {
    if (!isCompacting) setSessionTreeHidden(false)
  }, [isCompacting])

  return {
    handleSessionTreeNavigate,
    sessionTreeForceHidden: sessionTreeHidden,
    sessionTreeNavigateDisabled,
  }
}
