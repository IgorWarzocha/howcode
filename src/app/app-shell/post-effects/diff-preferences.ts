import {
  getProjectDiffBaselinePreference,
  getProjectDiffRenderModePreference,
} from '@howcode/shared/pi-thread-action-payloads'
import type { QueryClient } from '@tanstack/react-query'
import type { ThreadData } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import type { ActionPayload } from '../controller-action-utils'

export type DiffPreferencesPatch = {
  hasBaseline: boolean
  hasRenderMode: boolean
  nextBaseline: NonNullable<ThreadData['diffPreferences']>['baseline']
  nextRenderMode: NonNullable<ThreadData['diffPreferences']>['renderMode']
}

export function applyDiffPreferencesToThread(
  current: ThreadData | null | undefined,
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

  const baselinePreference = getProjectDiffBaselinePreference(payload)
  const renderModePreference = getProjectDiffRenderModePreference(payload)
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
  setLiveThreadData: (updater: (state: ThreadData | null) => ThreadData | null) => void
}) {
  const conversationId =
    typeof input.contextualPayload.conversationId === 'string'
      ? input.contextualPayload.conversationId
      : null
  if (!conversationId) return

  const patch = getDiffPreferencesPatch(input.contextualPayload)
  if (!patch) return

  input.queryClient.setQueryData(desktopQueryKeys.thread(conversationId), (current: unknown) =>
    applyDiffPreferencesToThread(current as ThreadData | null | undefined, patch),
  )
  input.setLiveThreadData((current) =>
    current?.conversationId === conversationId
      ? (applyDiffPreferencesToThread(current, patch) ?? null)
      : current,
  )
  await input.queryClient.invalidateQueries({
    queryKey: desktopQueryKeys.threadPrefix(conversationId),
  })
}
