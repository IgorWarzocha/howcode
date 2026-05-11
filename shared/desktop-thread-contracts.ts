import type { ProjectDiffPreferences } from './desktop-project-git-contracts'

export type Thread = {
  id: string
  title: string
  age: string
  lastModifiedMs?: number | undefined
  sessionPath?: string | undefined
  summary?: string | undefined
  running?: boolean | undefined
  unread?: boolean | undefined
  pinned?: boolean | undefined
}

export type InboxThread = {
  threadId: string
  title: string
  projectId: string
  projectName: string
  sessionPath: string
  age: string
  lastActivityMs?: number | undefined
  prompt: string | null
  content: string[]
  preview: string | null
  running: boolean
  unread: boolean
  isChat?: boolean | undefined
}

export type Project = {
  id: string
  resolvedId?: string | undefined
  name: string
  threads: Thread[]
  latestModifiedMs?: number | undefined
  pinned?: boolean | undefined
  collapsed?: boolean | undefined
  threadsLoaded?: boolean | undefined
  threadsScope?: 'chat' | 'code' | undefined
  threadCount?: number | undefined
  repoOriginUrl?: string | undefined | null
  repoOriginChecked?: boolean | undefined
}

export type ProjectUsageSessionSummary = {
  threadId: string
  title: string
  sessionPath: string
  lastModifiedMs?: number | undefined
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  assistantTurnCount: number
}

export type ProjectUsageSummary = {
  projectId: string
  sessionCount: number
  sessionsWithUsageCount: number
  assistantTurnCount: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  archivedUsageRefreshing?: boolean | undefined
  topSessions: ProjectUsageSessionSummary[]
}

export type ProjectImportCandidate = {
  projectId: string
  name: string
  isGitRepo: boolean
  hasOrigin: boolean
  originUrl: string | null
  alreadyImported: boolean
}

export type ArchivedThread = {
  id: string
  title: string
  age: string
  projectId: string
  projectName: string
  sessionPath: string
}

export type ProseMessage = {
  id: string
  role: 'assistant' | 'user'
  format?: 'prose' | 'list' | undefined
  content: string[]
  isError?: boolean | undefined
  stopReason?: 'length' | 'error' | 'aborted' | undefined
  usage?: AssistantUsageSummary | undefined
  thinkingContent?: string[] | undefined
  thinkingHeaders?: string[] | undefined
  thinkingRedacted?: boolean | undefined
}

export type AssistantUsageSummary = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
}

export type ToolResultMessage = {
  id: string
  role: 'toolResult'
  toolCallId?: string | undefined
  toolName: string
  content: string[]
  images?: ToolResultImage[] | undefined
  isError: boolean
  args?: string | undefined
  running?: boolean | undefined
}

export type ToolResultImage = {
  src: string
  mimeType: string
  alt: string
}

export type BashExecutionMessage = {
  id: string
  role: 'bashExecution'
  command: string
  output: string[]
  exitCode: number | null
  cancelled: boolean
  truncated: boolean
}

export type CustomThreadMessage = {
  id: string
  role: 'custom'
  customType: string
  content: string[]
  isError?: boolean | undefined
}

export type SystemThreadMessage = {
  id: string
  role: 'system'
  label: string
  content: string[]
}

export type SummaryThreadMessage = {
  id: string
  role: 'branchSummary' | 'compactionSummary'
  content: string[]
}

export type Message =
  | ProseMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomThreadMessage
  | SystemThreadMessage
  | SummaryThreadMessage

export type ThreadData = {
  sessionPath: string
  title: string
  messages: Message[]
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  diffPreferences?: ProjectDiffPreferences | undefined
}
