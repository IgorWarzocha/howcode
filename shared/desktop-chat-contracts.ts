import type { ComposerProfile } from './desktop-composer-contracts'
import type { DirectoryDiffPreferences } from './desktop-directory-git-contracts'

export type Chat = {
  composerProfile?: ComposerProfile | undefined
  id: string
  title: string
  age: string
  lastModifiedMs?: number | undefined
  conversationId?: string | undefined
  summary?: string | undefined
  running?: boolean | undefined
  unread?: boolean | undefined
  pinned?: boolean | undefined
  branchName?: string | null | undefined
}

export type DirectoryWorktreeInfo = {
  rootDirectoryId: string
  branchName: string | null
  parentBranchName?: string | null | undefined
  isMain: boolean
  source: 'howcode' | 'imported'
  completed?: boolean | undefined
}

export type InboxChat = {
  chatId: string
  title: string
  directoryId: string
  directoryName: string
  conversationId: string
  age: string
  lastActivityMs?: number | undefined
  prompt: string | null
  content: string[]
  preview: string | null
  running: boolean
  unread: boolean
  branchName?: string | null | undefined
  composerProfile?: 'general' | 'coding' | undefined
}

export type WorkingDirectory = {
  id: string
  resolvedId?: string | undefined
  name: string
  chats: Chat[]
  latestModifiedMs?: number | undefined
  pinned?: boolean | undefined
  collapsed?: boolean | undefined
  chatsLoaded?: boolean | undefined
  chatCount?: number | undefined
  repoOriginUrl?: string | undefined | null
  repoOriginChecked?: boolean | undefined
  worktreeDirectory?: string | undefined
  worktree?: DirectoryWorktreeInfo | undefined
}

export type DirectoryUsageSessionSummary = {
  chatId: string
  title: string
  conversationId: string
  lastModifiedMs?: number | undefined
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  assistantTurnCount: number
}

export type DirectoryUsageSummary = {
  directoryId: string
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
  topSessions: DirectoryUsageSessionSummary[]
}

export type DirectoryImportCandidate = {
  directoryId: string
  name: string
  isGitRepo: boolean
  hasOrigin: boolean
  originUrl: string | null
  alreadyImported: boolean
}

export type ArchivedChat = {
  id: string
  title: string
  age: string
  directoryId: string
  directoryName: string
  conversationId: string
  composerProfile?: 'general' | 'coding' | undefined
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
  rawArgs?: unknown | undefined
  details?: unknown | undefined
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

export type CustomChatMessage = {
  id: string
  role: 'custom'
  customType: string
  content: string[]
  isError?: boolean | undefined
  details?: unknown | undefined
}

export type ChatCustomMessageRecord = {
  id: string
  customType: string
  content: unknown
  display?: boolean | undefined
  details?: unknown | undefined
}

export type SystemChatMessage = {
  id: string
  role: 'system'
  label: string
  content: string[]
}

export type SummaryChatMessage = {
  id: string
  role: 'branchSummary' | 'compactionSummary'
  content: string[]
}

export type Message =
  | ProseMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomChatMessage
  | SystemChatMessage
  | SummaryChatMessage

export type ChatData = {
  conversationId: string
  title: string
  messages: Message[]
  customMessages?: ChatCustomMessageRecord[] | undefined
  previousMessageCount: number
  isStreaming: boolean
  isCompacting: boolean
  diffPreferences?: DirectoryDiffPreferences | undefined
}
