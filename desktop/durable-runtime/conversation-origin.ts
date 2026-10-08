import { defineDoc } from '@earendil-works/pi-durable'
import type { ComposerProfile } from '../../shared/desktop-composer-contracts.ts'

// Version 1 is already persisted in Durable. These keys are storage, not app API.
export type PersistedConversationOrigin = {
  appOwned: boolean
  projectId: string | null
  composerMode: 'chat' | 'code' | null
  chatGroupId: string | null
  branchName: string | null
}

export type ConversationOrigin = {
  appOwned: boolean
  directoryId: string | null
  composerProfile: ComposerProfile | null
  workspaceId: string | null
  branchName: string | null
}

export const RuntimeOriginDoc = defineDoc<PersistedConversationOrigin>({
  kind: 'howcode.origin',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({
    appOwned: false,
    projectId: null,
    composerMode: null,
    chatGroupId: null,
    branchName: null,
  }),
})

export function decodeConversationOrigin(origin: PersistedConversationOrigin): ConversationOrigin {
  return {
    appOwned: origin.appOwned,
    directoryId: origin.projectId,
    composerProfile:
      origin.composerMode === null ? null : origin.composerMode === 'chat' ? 'general' : 'coding',
    workspaceId: origin.chatGroupId,
    branchName: origin.branchName,
  }
}

export function encodeConversationOrigin(origin: ConversationOrigin): PersistedConversationOrigin {
  return {
    appOwned: origin.appOwned,
    projectId: origin.directoryId,
    composerMode:
      origin.composerProfile === null
        ? null
        : origin.composerProfile === 'general'
          ? 'chat'
          : 'code',
    chatGroupId: origin.workspaceId,
    branchName: origin.branchName,
  }
}
