import { useMemo, useRef, useState } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import { getDesktopActionErrorMessage } from '../desktop/action-results'
import { getErrorMessage } from '../desktop/error-messages'
import type { ComposerQueuedPrompt } from '../desktop/types'

export function useQueuedPromptCancellation({
  composerProjectId,
  handleAction,
  terminalConversationId,
}: {
  composerProjectId: string
  handleAction: AppShellController['desktop']['handleAction']
  terminalConversationId: string | null
}) {
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const pendingRef = useRef(new Set<string>())
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null)
  const scopePrefix = `${composerProjectId}:${terminalConversationId ?? ''}:`
  const pendingQueuedPromptIdsForSession = useMemo(
    () =>
      pendingIds.flatMap((key) =>
        key.startsWith(scopePrefix) ? [key.slice(scopePrefix.length)] : [],
      ),
    [pendingIds, scopePrefix],
  )
  const handleRemoveQueuedPrompt = async (prompt: ComposerQueuedPrompt) => {
    const key = `${scopePrefix}${prompt.id}`
    if (pendingRef.current.has(key)) return
    pendingRef.current.add(key)
    setPendingIds((current) => [...current, key])
    setFailure(null)
    try {
      const result = await handleAction('composer.dequeue', {
        projectId: composerProjectId,
        conversationId: terminalConversationId,
        queueId: prompt.id,
      })
      const message = getDesktopActionErrorMessage(result, 'Could not cancel queued message.')
      if (message) setFailure({ scope: scopePrefix, message })
    } catch (error) {
      setFailure({
        scope: scopePrefix,
        message: getErrorMessage(error, 'Could not cancel queued message.'),
      })
    } finally {
      pendingRef.current.delete(key)
      setPendingIds((current) => current.filter((id) => id !== key))
    }
  }
  return {
    handleRemoveQueuedPrompt,
    pendingQueuedPromptIdsForSession,
    queuedPromptError: failure?.scope === scopePrefix ? failure.message : null,
  }
}
