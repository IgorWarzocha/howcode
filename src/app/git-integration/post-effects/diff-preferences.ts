import {
  getDirectoryDiffBaselinePreference,
  getDirectoryDiffRenderModePreference,
} from '@howaboua/howcode-git/action-payloads'
import type { QueryClient } from '@tanstack/react-query'
import type { ActionPayload } from '../../app-shell/controller-action-utils'
import type { ChatData } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'

export type DiffPreferencesPatch = {
  hasBaseline: boolean
  hasRenderMode: boolean
  nextBaseline: NonNullable<ChatData['diffPreferences']>['baseline']
  nextRenderMode: NonNullable<ChatData['diffPreferences']>['renderMode']
}

export function applyDiffPreferencesToChat(
  current: ChatData | null | undefined,
  input: DiffPreferencesPatch,
) {
  if (!current) return current
  return {
    ...current,
    diffPreferences: {
      baseline: input.hasBaseline
        ? input.nextBaseline
        : (current.diffPreferences?.baseline ?? null),
      renderMode: input.hasRenderMode
        ? input.nextRenderMode
        : (current.diffPreferences?.renderMode ?? null),
    },
  }
}

export function getDiffPreferencesPatch(payload: ActionPayload): DiffPreferencesPatch | null {
  if (typeof payload.conversationId !== 'string') return null

  const baselinePreference = getDirectoryDiffBaselinePreference(payload)
  const renderModePreference = getDirectoryDiffRenderModePreference(payload)
  if (baselinePreference === 'invalid' || renderModePreference === 'invalid') return null

  return {
    hasBaseline: baselinePreference !== undefined,
    hasRenderMode: renderModePreference !== undefined,
    nextBaseline: baselinePreference ?? null,
    nextRenderMode: renderModePreference ?? null,
  }
}

export async function applyDiffPreferencesPostEffect(input: {
  contextualPayload: ActionPayload
  queryClient: QueryClient
  setLiveChatData: (updater: (state: ChatData | null) => ChatData | null) => void
}) {
  const conversationId =
    typeof input.contextualPayload.conversationId === 'string'
      ? input.contextualPayload.conversationId
      : null
  if (!conversationId) return

  const patch = getDiffPreferencesPatch(input.contextualPayload)
  if (!patch) return

  input.queryClient.setQueryData(desktopQueryKeys.chat(conversationId), (current: unknown) =>
    applyDiffPreferencesToChat(current as ChatData | null | undefined, patch),
  )
  input.setLiveChatData((current) =>
    current?.conversationId === conversationId
      ? (applyDiffPreferencesToChat(current, patch) ?? null)
      : current,
  )
  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.chatPrefix(conversationId),
  })
}
