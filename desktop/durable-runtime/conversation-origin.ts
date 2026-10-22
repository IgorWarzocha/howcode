import { defineDoc } from '@earendil-works/pi-durable'
import { Schema } from 'effect'

export type ConversationOrigin = {
  appOwned: boolean
  directoryId: string | null
  workspaceId: string | null
  branchName: string | null
}

const legacyOrigin = Schema.Struct({
  appOwned: Schema.Boolean,
  projectId: Schema.NullOr(Schema.String),
  chatGroupId: Schema.NullOr(Schema.String),
  branchName: Schema.NullOr(Schema.String),
})

export const RuntimeOriginDoc = defineDoc<ConversationOrigin>({
  kind: 'howcode.origin',
  version: 2,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  checkpointWhen: () => true,
  initial: () => ({
    appOwned: false,
    directoryId: null,
    workspaceId: null,
    branchName: null,
  }),
  migrate(value, fromVersion) {
    if (fromVersion !== 1) throw new Error(`Unsupported origin version: ${fromVersion}`)
    const origin = Schema.decodeUnknownSync(legacyOrigin)(value)
    return {
      appOwned: origin.appOwned,
      directoryId: origin.projectId,
      workspaceId: origin.chatGroupId,
      branchName: origin.branchName,
    }
  },
})
