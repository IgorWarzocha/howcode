export type ConversationSummaryRecord = {
  id: string
  cwd: string
  conversationId: string
  title: string
  lastModifiedMs: number
  branchName?: string | undefined | null | undefined
}

export type ThreadRow = typeof ThreadRowSchema.Type
export type InboxThreadRow = typeof InboxThreadRowSchema.Type

export type ArchivedThreadRow = typeof ArchivedThreadRowSchema.Type

export type ThreadPathRow = {
  id?: string | undefined
  conversationId: string
}

export type ProjectUsageTotalsRow = {
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

export type ThreadDiffPreferencesRow = {
  diffBaselineJson: string | null
  diffRenderMode: string | null
}

export type ThreadCwdRow = {
  cwd: string
}

import type {
  ArchivedThreadRowSchema,
  InboxThreadRowSchema,
  ThreadRowSchema,
} from './row-schema.ts'
