import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../../shared/desktop-contracts.ts'
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

export const setThreadRunningState = Effect.fn('threadStateDb.setThreadRunningState')(function* (
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

export const setThreadDiffPreferences = Effect.fn('threadStateDb.setThreadDiffPreferences')(
  function* (
    conversationId: string,
    preferences: {
      baseline?: ProjectDiffBaseline | null
      renderMode?: ProjectDiffRenderMode | null
    },
  ) {
    const updates: {
      diff_baseline_json?: string | null
      diff_render_mode?: ProjectDiffRenderMode | null
    } = {}

    if ('baseline' in preferences) {
      updates.diff_baseline_json = preferences.baseline
        ? JSON.stringify(preferences.baseline)
        : null
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
    return getChanges(result, 'thread diff preferences update') > 0
  },
)

export const toggleThreadPinned = Effect.fn('threadStateDb.toggleThreadPinned')(function* (
  threadId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [threadId],
  )
})

export const renameThreadTitle = Effect.fn('threadStateDb.renameThreadTitle')(function* (
  threadId: string,
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
    [normalizedTitle, normalizedTitle, threadId],
  ).raw
  return getChanges(result, 'thread title update') > 0
})

export const assignThreadBranch = Effect.fn('threadStateDb.assignThreadBranch')(function* (
  threadId: string,
  branchName: string | null,
) {
  return yield* assignThreadToProjectBranch(threadId, branchName)
})

export const assignThreadToProjectBranch = Effect.fn('threadStateDb.assignThreadToProjectBranch')(
  function* (threadId: string, branchName: string | null, projectId?: string | null) {
    const normalizedBranchName = branchName?.trim() || null
    const normalizedProjectId = projectId?.trim() || null
    const sql = yield* SqlClient.SqlClient
    const current = (yield* sql.unsafe<{ projectId?: string | undefined }>(
      `
        SELECT cwd AS projectId
        FROM conversation_facts
        WHERE id = ?
      `,
      [threadId],
    ))[0]

    if (normalizedProjectId) {
      yield* sql.unsafe(
        `
        INSERT INTO projects (cwd, name)
        VALUES (?, ?)
        ON CONFLICT(cwd) DO NOTHING
      `,
        [
          normalizedProjectId,
          normalizedProjectId.split(pathSeparatorPattern).filter(Boolean).at(-1) ||
            normalizedProjectId,
        ],
      )
    }

    if (normalizedProjectId) {
      yield* sql.unsafe(
        `
        UPDATE conversation_facts
        SET cwd = ?, branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [normalizedProjectId, normalizedBranchName, threadId],
      )
    } else {
      yield* sql.unsafe(
        `
        UPDATE conversation_facts
        SET branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [normalizedBranchName, threadId],
      )
    }

    const nextProjectId = normalizedProjectId ?? current?.projectId
    return {
      affectedProjectIds: [...new Set([current?.projectId, nextProjectId].filter(isString))],
      projectId: nextProjectId,
    }
  },
)

export const archiveThread = Effect.fn('threadStateDb.archiveThread')(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [threadId],
  )
})

export const archiveThreads = Effect.fn('threadStateDb.archiveThreads')(function* (
  threadIds: string[],
) {
  yield* updateArchivedFlag(threadIds, true)
})

export const restoreThreads = Effect.fn('threadStateDb.restoreThreads')(function* (
  threadIds: string[],
) {
  yield* updateArchivedFlag(threadIds, false)
})

const updateArchivedFlag = Effect.fn('threadStateDb.updateArchivedFlag')(function* (
  threadIds: string[],
  archived: boolean,
) {
  if (threadIds.length === 0) {
    return
  }

  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      for (const threadId of threadIds) {
        yield* sql.unsafe(
          `
            UPDATE conversation_facts
            SET archived = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [archived ? 1 : 0, threadId],
        )
      }
    }),
  )
})

export const restoreThread = Effect.fn('threadStateDb.restoreThread')(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [threadId],
  )
})

export const deleteThreadRecord = Effect.fn('threadStateDb.deleteThreadRecord')(function* (
  threadId: string,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE conversation_facts SET deleted = 1, running = 0
      WHERE id = ?
    `,
    [threadId],
  )
})

export const deleteThreadRecordsByConversationIds = Effect.fn(
  'threadStateDb.deleteThreadRecordsByConversationIds',
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
