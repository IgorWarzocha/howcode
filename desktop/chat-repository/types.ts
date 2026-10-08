export type ConversationSummaryRecord = {
  id: string
  cwd: string
  conversationId: string
  title: string
  lastModifiedMs: number
  branchName?: string | undefined | null | undefined
}

export type ChatRow = typeof ChatRowSchema.Type
export type InboxChatRow = typeof InboxChatRowSchema.Type

export type ArchivedChatRow = typeof ArchivedChatRowSchema.Type

export type ChatPathRow = {
  id?: string | undefined
  conversationId: string
}

export type DirectoryUsageTotalsRow = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  assistantTurnCount: number
  sessionCount: number
  sessionsWithUsageCount: number
}

export type ChatDiffPreferencesRow = {
  diffBaselineJson: string | null
  diffRenderMode: string | null
}

export type ChatCwdRow = {
  cwd: string
}

import type { ArchivedChatRowSchema, ChatRowSchema, InboxChatRowSchema } from './row-schema.ts'
