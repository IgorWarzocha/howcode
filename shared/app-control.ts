import { Type } from '@earendil-works/pi-ai'
import type {
  FeatureOperationCaller,
  FeatureOperationResult,
} from '@howaboua/howcode-sdk/feature-operations'

export type AppControlResult = FeatureOperationResult

/** Trusted invocation identity, never accepted from tool arguments. */
export type AppControlCaller = FeatureOperationCaller

export const appControlTool = {
  name: 'howcode',
  description: 'Manage Howcode and call selected feature operations. Call with {} for help',
  inputSchema: Type.Object(
    {
      action: Type.Optional(Type.String()),
      workspace: Type.Optional(Type.String()),
      chat: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      message: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
      operation: Type.Optional(Type.String()),
      input: Type.Optional(Type.Unknown()),
      conversationId: Type.Optional(Type.String()),
      extension: Type.Optional(Type.String()),
      enabled: Type.Optional(Type.Boolean()),
      cursor: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    },
    { additionalProperties: false },
  ),
} as const
