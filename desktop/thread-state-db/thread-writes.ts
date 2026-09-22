import { Effect } from 'effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../../shared/desktop-contracts.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

const pathSeparatorPattern = /[\\/]/

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export type ProjectUsageTotalsDelta = {
  cwd: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  costTotal: number
  assistantTurnCount: number
  sessionsWithUsageCount?: number | undefined
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
  sessionPath: string,
  running: boolean,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      UPDATE threads
      SET running = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ? AND running != ?
    `,
    [running ? 1 : 0, sessionPath, running ? 1 : 0],
  )
})

export const setThreadDiffPreferences = Effect.fn('threadStateDb.setThreadDiffPreferences')(
  function* (
    sessionPath: string,
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
      UPDATE threads
      SET ${sql.update(updates)}, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ${sessionPath}
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
      UPDATE threads
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
      UPDATE threads
      SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [normalizedTitle, threadId],
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
        FROM threads
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
        UPDATE threads
        SET cwd = ?, branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [normalizedProjectId, normalizedBranchName, threadId],
      )
    } else {
      yield* sql.unsafe(
        `
        UPDATE threads
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
      UPDATE threads
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
            UPDATE threads
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
      UPDATE threads
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
      DELETE FROM threads
      WHERE id = ?
    `,
    [threadId],
  )
})

export const addProjectUsageTotals = Effect.fn('threadStateDb.addProjectUsageTotals')(function* (
  snapshot: ProjectUsageTotalsDelta,
) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      INSERT INTO project_usage_totals (
        cwd,
        input,
        output,
        cache_read,
        cache_write,
        total_tokens,
        cost_total,
        assistant_turn_count,
        session_count,
        sessions_with_usage_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cwd) DO UPDATE SET
        input = project_usage_totals.input + excluded.input,
        output = project_usage_totals.output + excluded.output,
        cache_read = project_usage_totals.cache_read + excluded.cache_read,
        cache_write = project_usage_totals.cache_write + excluded.cache_write,
        total_tokens = project_usage_totals.total_tokens + excluded.total_tokens,
        cost_total = project_usage_totals.cost_total + excluded.cost_total,
        assistant_turn_count = project_usage_totals.assistant_turn_count + excluded.assistant_turn_count,
        session_count = project_usage_totals.session_count + excluded.session_count,
        sessions_with_usage_count = project_usage_totals.sessions_with_usage_count + excluded.sessions_with_usage_count
    `,
    [
      snapshot.cwd,
      snapshot.input,
      snapshot.output,
      snapshot.cacheRead,
      snapshot.cacheWrite,
      snapshot.totalTokens,
      snapshot.costTotal,
      snapshot.assistantTurnCount,
      1,
      snapshot.sessionsWithUsageCount ?? (snapshot.assistantTurnCount > 0 ? 1 : 0),
    ],
  )
})

export const deleteThreadRecordsBySessionPaths = Effect.fn(
  'threadStateDb.deleteThreadRecordsBySessionPaths',
)(function* (sessionPaths: string[]) {
  if (sessionPaths.length === 0) {
    return
  }

  const sql = yield* SqlClient.SqlClient
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      for (const sessionPath of sessionPaths) {
        yield* sql.unsafe(
          `
            DELETE FROM threads
            WHERE session_path = ?
          `,
          [sessionPath],
        )
      }
    }),
  )
})
