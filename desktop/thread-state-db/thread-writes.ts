import type { ProjectDiffBaseline, ProjectDiffRenderMode } from '../../shared/desktop-contracts.ts'
import { getThreadStateDatabase } from './db.ts'
import { runInTransaction } from './write-transaction.ts'

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

export function setThreadRunningState(sessionPath: string, running: boolean) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      UPDATE threads
      SET running = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ? AND running != ?
    `,
  ).run(running ? 1 : 0, sessionPath, running ? 1 : 0)
}

export function setThreadDiffPreferences(
  sessionPath: string,
  preferences: {
    baseline?: ProjectDiffBaseline | null
    renderMode?: ProjectDiffRenderMode | null
  },
): boolean {
  const assignments: string[] = []
  const values: unknown[] = []

  if ('baseline' in preferences) {
    assignments.push('diff_baseline_json = ?')
    values.push(preferences.baseline ? JSON.stringify(preferences.baseline) : null)
  }

  if ('renderMode' in preferences) {
    assignments.push('diff_render_mode = ?')
    values.push(preferences.renderMode ?? null)
  }

  if (assignments.length === 0) {
    return true
  }

  const db = getThreadStateDatabase()
  const result = db
    .prepare(
      `
      UPDATE threads
      SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE session_path = ?
    `,
    )
    .run(...values, sessionPath) as { changes: number }
  return result.changes > 0
}

export function toggleThreadPinned(threadId: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      UPDATE threads
      SET pinned = CASE pinned WHEN 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId)
}

export function assignThreadBranch(threadId: string, branchName: string | null) {
  return assignThreadToProjectBranch(threadId, branchName)
}

export function assignThreadToProjectBranch(
  threadId: string,
  branchName: string | null,
  projectId?: string | null,
) {
  const normalizedBranchName = branchName?.trim() || null
  const normalizedProjectId = projectId?.trim() || null
  const db = getThreadStateDatabase()
  const current = db
    .prepare(
      `
        SELECT cwd AS projectId
        FROM threads
        WHERE id = ?
      `,
    )
    .get(threadId) as { projectId?: string | undefined } | undefined

  if (normalizedProjectId) {
    db.prepare(
      `
        INSERT INTO projects (cwd, name)
        VALUES (?, ?)
        ON CONFLICT(cwd) DO NOTHING
      `,
    ).run(
      normalizedProjectId,
      normalizedProjectId.split(pathSeparatorPattern).filter(Boolean).at(-1) || normalizedProjectId,
    )
  }

  if (normalizedProjectId) {
    db.prepare(
      `
        UPDATE threads
        SET cwd = ?, branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(normalizedProjectId, normalizedBranchName, threadId)
  } else {
    db.prepare(
      `
        UPDATE threads
        SET branch_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(normalizedBranchName, threadId)
  }

  const nextProjectId = normalizedProjectId ?? current?.projectId
  return {
    affectedProjectIds: [...new Set([current?.projectId, nextProjectId].filter(isString))],
    projectId: nextProjectId,
  }
}

export function archiveThread(threadId: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      UPDATE threads
      SET archived = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId)
}

export function archiveThreads(threadIds: string[]) {
  updateArchivedFlag(threadIds, true)
}

export function restoreThreads(threadIds: string[]) {
  updateArchivedFlag(threadIds, false)
}

function updateArchivedFlag(threadIds: string[], archived: boolean) {
  if (threadIds.length === 0) {
    return
  }

  const db = getThreadStateDatabase()
  const updateThread = db.prepare(
    `
      UPDATE threads
      SET archived = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  )

  runInTransaction(db, () => {
    for (const threadId of threadIds) {
      updateThread.run(archived ? 1 : 0, threadId)
    }
  })
}

export function restoreThread(threadId: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      UPDATE threads
      SET archived = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(threadId)
}

export function deleteThreadRecord(threadId: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      DELETE FROM threads
      WHERE id = ?
    `,
  ).run(threadId)
}

export function addProjectUsageTotals(snapshot: ProjectUsageTotalsDelta) {
  const db = getThreadStateDatabase()
  db.prepare(
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
  ).run(
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
  )
}

export function deleteThreadRecordsBySessionPaths(sessionPaths: string[]) {
  if (sessionPaths.length === 0) {
    return
  }

  const db = getThreadStateDatabase()
  const deleteThreadBySessionPath = db.prepare(
    `
      DELETE FROM threads
      WHERE session_path = ?
    `,
  )

  runInTransaction(db, () => {
    for (const sessionPath of sessionPaths) {
      deleteThreadBySessionPath.run(sessionPath)
    }
  })
}
