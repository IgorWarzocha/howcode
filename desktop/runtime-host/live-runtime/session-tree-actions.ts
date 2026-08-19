import type { ComposerStateRequest } from '../../../shared/desktop-contracts.ts'
import { labelSessionTreeEntry, navigateSessionTree } from '../session-tree-navigation.ts'

export async function navigateSessionTreeInHost(
  request: ComposerStateRequest & {
    targetEntryId: string
    summarize: boolean
    label?: string | undefined | null
  },
) {
  return navigateSessionTree({
    request,
    targetEntryId: request.targetEntryId,
    summarize: request.summarize,
    label: request.label,
  })
}

export async function labelSessionTreeEntryInHost(
  request: ComposerStateRequest & {
    targetEntryId: string
    label?: string | undefined | null
  },
) {
  return labelSessionTreeEntry({
    request,
    targetEntryId: request.targetEntryId,
    label: request.label,
  })
}
