import type { DirectoryDiffPreferences } from '@howaboua/howcode-git/contracts'
import type { Message } from '@howaboua/howcode-sdk/chat-renderer'

export type Chat = {
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
}

export type {
  AssistantUsageSummary,
  BashExecutionMessage,
  CustomChatMessage,
  Message,
  ProseMessage,
  SummaryChatMessage,
  SystemChatMessage,
  ToolResultImage,
  ToolResultMessage,
} from '@howaboua/howcode-sdk/chat-renderer'

export type ChatCustomMessageRecord = {
  id: string
  customType: string
  content: unknown
  display?: boolean | undefined
  details?: unknown | undefined
}

export type ChatData = {
  conversationId: string
  title: string
  messages: Message[]
  customMessages?: ChatCustomMessageRecord[] | undefined
  previousMessageCount: number
  isStreaming: boolean
  hostObservedAtMs?: number
  isCompacting: boolean
  diffPreferences?: DirectoryDiffPreferences | undefined
}
