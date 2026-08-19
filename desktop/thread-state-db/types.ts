export type SessionSummaryRecord = {
  id: string
  cwd: string
  sessionPath: string
  title: string
  lastModifiedMs: number
  branchName?: string | undefined | null | undefined
}

export type ProjectRow = typeof ProjectRowSchema.Type
export type ThreadRow = typeof ThreadRowSchema.Type
export type InboxThreadRow = typeof InboxThreadRowSchema.Type

export type ThreadInboxMessageRecord = {
  sessionPath: string
  userPrompt: string | null
  content: string[]
  preview: string | null
  lastAssistantAtMs: number
}

export type InboxPathRow = {
  sessionPath: string
}

export type ThreadAssistantSnapshotRow = {
  messageJson: string | null
  preview: string | null
}

export type ArchivedThreadRow = typeof ArchivedThreadRowSchema.Type

export type ThreadPathRow = {
  id?: string | undefined
  sessionPath: string
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

export type ThreadDeletionSnapshotRow = {
  cwd: string
  title: string
  sessionPath: string
  lastModifiedMs: number
}

import type {
  ArchivedThreadRowSchema,
  InboxThreadRowSchema,
  ProjectRowSchema,
  ThreadRowSchema,
} from './row-schema.ts'
