import { Type } from '@earendil-works/pi-ai'

export type AppControlResult =
  | null
  | boolean
  | number
  | string
  | AppControlResult[]
  | { [key: string]: AppControlResult }

/** Trusted invocation identity, never accepted from tool arguments. */
export type AppControlCaller = {
  conversationId?: string
  signal?: AbortSignal
}

export const appControlTool = {
  name: 'howcode',
  description: 'Manage Howcode workspaces and chats. Call with {} for help',
  inputSchema: Type.Object(
    {
      action: Type.Optional(Type.String()),
      workspace: Type.Optional(Type.String()),
      chat: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      message: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
      cursor: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    },
    { additionalProperties: false },
  ),
} as const
