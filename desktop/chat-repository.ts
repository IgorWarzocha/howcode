import {
  repairConversationProjection as repairProjection,
  listDirectoryUsageConversations as usageConversations,
} from './chat-repository/conversation-projection.ts'
import { databaseOperation } from './chat-repository/db.ts'
import * as queries from './chat-repository/queries.ts'
import * as writes from './chat-repository/writes.ts'

export type { ConversationSummaryRecord } from './chat-repository/types.ts'

export const getChatCwd = databaseOperation(queries.getChatCwd)
export const getChatDiffPreferences = databaseOperation(queries.getChatDiffPreferences)
export const getChatConversationId = databaseOperation(queries.getChatConversationId)
export const listArchivedDirectoryChats = databaseOperation(queries.listArchivedDirectoryChats)
export const listArchivedChats = databaseOperation(queries.listArchivedChats)
export const listBranchConversationIds = databaseOperation(queries.listBranchConversationIds)
export const listBranchChatIds = databaseOperation(queries.listBranchChatIds)
export const listInboxChats = databaseOperation(queries.listInboxChats)
export const listDirectoryConversationIds = databaseOperation(queries.listDirectoryConversationIds)
export const listDirectoryChatIds = databaseOperation(queries.listDirectoryChatIds)
export const listDirectoryChats = databaseOperation(queries.listDirectoryChats)

export const archiveChat = databaseOperation(writes.archiveChat)
export const archiveChats = databaseOperation(writes.archiveChats)
export const assignChatBranch = databaseOperation(writes.assignChatBranch)
export const assignChatToDirectoryBranch = databaseOperation(writes.assignChatToDirectoryBranch)
export const clearReadInboxChats = databaseOperation(writes.clearReadInboxChats)
export const deleteChatRecord = databaseOperation(writes.deleteChatRecord)
export const deleteChatRecordsByConversationIds = databaseOperation(
  writes.deleteChatRecordsByConversationIds,
)
export const dismissInboxChat = databaseOperation(writes.dismissInboxChat)
export const dismissInboxChatAfterReply = databaseOperation(writes.dismissInboxChatAfterReply)
export const ensureDirectory = databaseOperation(writes.ensureDirectory)
export const markInboxChatRead = databaseOperation(writes.markInboxChatRead)
export const renameChatTitle = databaseOperation(writes.renameChatTitle)
export const restoreChat = databaseOperation(writes.restoreChat)
export const restoreChats = databaseOperation(writes.restoreChats)
export const setChatDiffPreferences = databaseOperation(writes.setChatDiffPreferences)
export const setChatRunningState = databaseOperation(writes.setChatRunningState)
export const toggleChatPinned = databaseOperation(writes.toggleChatPinned)
export const upsertChatSummary = databaseOperation(writes.upsertChatSummary)

export const repairConversationProjection = databaseOperation(repairProjection)
export const listDirectoryUsageConversations = databaseOperation(usageConversations)
