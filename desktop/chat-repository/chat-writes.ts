import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type {
  DirectoryDiffBaseline,
  DirectoryDiffRenderMode,
} from '../../shared/desktop-contracts.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

const pathSeparatorPattern = /[\\/]/

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function getChanges(result: unknown, operation: string) {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('changes' in result) ||
    typeof result.changes !== 'number'
  ) {
    throw new Error(`Invalid ${operation} result.`)
  }
  return result.changes
}

export const setChatRunningState = Effect.fn('chatRepository.setChatRunningState')(function* (
  conversationId: string,
  running: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET running = ?, updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND running != ?
    `,
    [running ? 1 : 0, conversationId, running ? 1 : 0],
  )
})

export const setChatDiffPreferences = Effect.fn('chatRepository.setChatDiffPreferences')(function* (
  conversationId: string,
  preferences: {
    baseline?: DirectoryDiffBaseline | null
    renderMode?: DirectoryDiffRenderMode | null
  },
) {
  const updates: {
    diff_baseline_json?: string | null
    diff_render_mode?: DirectoryDiffRenderMode | null
  } = {}

  if ('baseline' in preferences) {
    updates.diff_baseline_json = preferences.baseline ? JSON.stringify(preferences.baseline) : null
  }

  if ('renderMode' in preferences) {
    updates.diff_render_mode = preferences.renderMode ?? null
  }

  if (Object.keys(updates).length === 0) {
    return true
  }

  const sql = yield* SqlClient.SqlClient
  const result = yield* sql`
      UPDATE conversation_facts
      SET ${sql.update(updates)}, updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ${conversationId}
    `.raw
  return getChanges(result, 'chat diff preferences update') > 0
})

export const toggleChatPinned = Effect.fn('chatRepository.toggleChatPinned')(function* (
  chatId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [chatId],
  )
})

export const renameChatTitle = Effect.fn('chatRepository.renameChatTitle')(function* (
  chatId: string,
  title: string,
) {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return false
  const sql = yield* SqlClient.SqlClient
  const result = yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET title = ?, custom_title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [normalizedTitle, normalizedTitle, chatId],
  ).raw
  return getChanges(result, 'chat title update') > 0
})

export const assignChatBranch = Effect.fn('chatRepository.assignChatBranch')(function* (
  chatId: string,
  branchName: string | null,
) {
  return yield* assignChatToDirectoryBranch(chatId, branchName)
})

export const assignChatToDirectoryBranch = Effect.fn('chatRepository.assignChatToDirectoryBranch')(
  function* (chatId: string, branchName: string | null, directoryId?: string | null) {
    const normalizedBranchName = branchName?.trim() || null
    const normalizedDirectoryId = directoryId?.trim() || null
    const sql = yield* SqlClient.SqlClient
    const current = (yield* sql.unsafe<{ directoryId?: string | undefined }>(
      `
        SELECT cwd AS directoryId
        FROM conversation_facts
        WHERE id = ?
      `,
      [chatId],
    ))[0]

    if (normalizedDirectoryId) {
      yield* sql.unsafe(
        `
        INSERT INTO projects (cwd, name)
        VALUES (?, ?)
        ON CONFLICT(cwd) DO NOTHING
      `,
        [
          normalizedDirectoryId,
          normalizedDirectoryId.split(pathSeparatorPattern).filter(Boolean).at(-1) ||
            normalizedDirectoryId,
        ],
      )
    }

    if (normalizedDirectoryId) {
      yield* sql.unsafe(
        `
        UPDATE conversation_facts
        SET cwd = ?, branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [normalizedDirectoryId, normalizedBranchName, chatId],
      )
    } else {
      yield* sql.unsafe(
        `
        UPDATE conversation_facts
        SET branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [normalizedBranchName, chatId],
      )
    }

    const nextDirectoryId = normalizedDirectoryId ?? current?.directoryId
    return {
      affectedDirectoryIds: [...new Set([current?.directoryId, nextDirectoryId].filter(isString))],
      directoryId: nextDirectoryId,
    }
  },
)

export const archiveChat = Effect.fn('chatRepository.archiveChat')(function* (chatId: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [chatId],
  )
})

export const archiveChats = Effect.fn('chatRepository.archiveChats')(function* (chatIds: string[]) {
  yield* updateArchivedFlag(chatIds, true)
})

export const restoreChats = Effect.fn('chatRepository.restoreChats')(function* (chatIds: string[]) {
  yield* updateArchivedFlag(chatIds, false)
})

const updateArchivedFlag = Effect.fn('chatRepository.updateArchivedFlag')(function* (
  chatIds: string[],
  archived: boolean,
) {
  if (chatIds.length === 0) {
    return
  }

  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      for (const chatId of chatIds) {
        yield* sql.unsafe(
          `
            UPDATE conversation_facts
            SET archived = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [archived ? 1 : 0, chatId],
        )
      }
    }),
  )
})

export const restoreChat = Effect.fn('chatRepository.restoreChat')(function* (chatId: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [chatId],
  )
})

export const deleteChatRecord = Effect.fn('chatRepository.deleteChatRecord')(function* (
  chatId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts SET deleted = 1, running = 0
      WHERE id = ?
    `,
    [chatId],
  )
})

export const deleteChatRecordsByConversationIds = Effect.fn(
  'chatRepository.deleteChatRecordsByConversationIds',
)(function* (conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return
  }

  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      for (const conversationId of conversationIds) {
        yield* sql.unsafe(
          `
            UPDATE conversation_facts SET deleted = 1, running = 0
            WHERE conversation_id = ?
          `,
          [conversationId],
        )
      }
    }),
  )
})
