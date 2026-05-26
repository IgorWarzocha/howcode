export type SessionSummaryRecord = {
  id: string
  cwd: string
  sessionPath: string
  title: string
  lastModifiedMs: number
}

export type ProjectRow = {
  id: string
  name: string
  pinned: number
  collapsed: number
  threadCount: number
  latestModifiedMs: number
  repoOriginUrl: string | null
  repoOriginChecked: number
  gitOpsMode: string | null
  worktreeRootProjectId: string | null
  worktreeBranchName: string | null
  worktreeIsMain: number | null
  worktreeSource: string | null
  worktreeCompleted: number | null
  worktreeDirectory: string | null
}

export type ThreadRow = {
  id: string
  title: string
  sessionPath: string
  summary: string | null
  running: number
  unread: number
  pinned: number
  branchName: string | null
  lastModifiedMs: number
}

export type InboxThreadRow = {
  threadId: string
  title: string
  projectId: string
  projectName: string
  sessionPath: string
  lastUserPrompt: string | null
  lastAssistantMessageJson: string | null
  lastAssistantPreview: string | null
  running: number
  unread: number
  lastActivityMs: number
  isChat: number
}

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

export type ArchivedThreadRow = {
  id: string
  title: string
  sessionPath: string
  projectId: string
  projectName: string
  lastModifiedMs: number
  isChat: number
}

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
