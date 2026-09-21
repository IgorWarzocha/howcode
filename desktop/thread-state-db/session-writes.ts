import { createHash } from 'node:crypto'
import path from 'node:path'
import { Effect } from 'effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import { ensureProject } from './project-writes.ts'
import type { SessionSummaryRecord } from './types.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

type ThreadIdPathRow = {
  id?: string | undefined
  sessionPath: string
}

function upsertThreadSummaryStatement(
  sql: SqlClient.SqlClient,
  threadId: string,
  session: SessionSummaryRecord,
) {
  return sql`
    INSERT INTO threads (id, cwd, session_path, title, last_modified_ms, branch_name)
    VALUES (${threadId}, ${session.cwd}, ${session.sessionPath}, ${session.title},
      ${session.lastModifiedMs}, COALESCE(${session.branchName?.trim() || null}, (
        SELECT branch_name FROM project_worktrees WHERE cwd = ${session.cwd} AND is_main = 0
      )))
    ON CONFLICT(session_path) DO UPDATE SET
      id = excluded.id,
      cwd = excluded.cwd,
      title = excluded.title,
      last_modified_ms = excluded.last_modified_ms,
      branch_name = COALESCE(threads.branch_name, excluded.branch_name),
      updated_at = CURRENT_TIMESTAMP
  `
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function getDisambiguatedThreadId(session: SessionSummaryRecord) {
  const suffix = createHash('sha256').update(session.sessionPath).digest('hex').slice(0, 8)
  return `${session.id}:${suffix}`
}

const getStoredDuplicateThreadRows = Effect.fn('threadStateDb.getStoredDuplicateThreadRows')(
  function* (session: SessionSummaryRecord) {
    const sql = yield* SqlClient.SqlClient
    return yield* sql.unsafe<ThreadIdPathRow>(
      `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE (id = ? OR id LIKE ? ESCAPE '\\')
          AND session_path != ?
      `,
      [session.id, `${escapeLikePattern(session.id)}:%`, session.sessionPath],
    )
  },
)

const getStoredThreadRowForPath = Effect.fn('threadStateDb.getStoredThreadRowForPath')(function* (
  sessionPath: string,
) {
  const sql = yield* SqlClient.SqlClient
  return (yield* sql.unsafe<ThreadIdPathRow>(
    `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE session_path = ?
      `,
    [sessionPath],
  ))[0]
})

const getIndexedSessionThreadId = Effect.fn('threadStateDb.getIndexedSessionThreadId')(function* (
  session: SessionSummaryRecord,
  duplicateSessionIds: Set<string>,
) {
  const storedThreadForPath = yield* getStoredThreadRowForPath(session.sessionPath)
  if (storedThreadForPath?.id && storedThreadForPath.id !== session.id) {
    return storedThreadForPath.id
  }

  if (duplicateSessionIds.has(session.id)) return getDisambiguatedThreadId(session)
  return (yield* getStoredDuplicateThreadRows(session)).length > 0
    ? getDisambiguatedThreadId(session)
    : session.id
})

function getDuplicateSessionIds(sessions: SessionSummaryRecord[]) {
  const sessionPathsById = new Map<string, Set<string>>()

  for (const session of sessions) {
    const sessionPaths = sessionPathsById.get(session.id) ?? new Set<string>()
    sessionPaths.add(session.sessionPath)
    sessionPathsById.set(session.id, sessionPaths)
  }

  return new Set(
    [...sessionPathsById.entries()].flatMap(([sessionId, sessionPaths]) =>
      sessionPaths.size > 1 ? [sessionId] : [],
    ),
  )
}

export const syncSessionSummaries = Effect.fn('threadStateDb.syncSessionSummaries')(function* (
  cwd: string,
  sessions: SessionSummaryRecord[],
) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureProject(cwd)
  yield* withDatabaseTransaction(
    Effect.gen(function* () {
      const duplicateSessionIds = getDuplicateSessionIds(sessions)

      for (const session of sessions) {
        yield* sql.unsafe(
          `
            INSERT INTO projects (cwd, name, collapsed, hidden)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(cwd) DO UPDATE SET
              name = excluded.name,
              updated_at = CURRENT_TIMESTAMP
          `,
          [session.cwd, path.basename(session.cwd) || session.cwd],
        )
        const threadId = yield* getIndexedSessionThreadId(session, duplicateSessionIds)

        yield* upsertThreadSummaryStatement(sql, threadId, session)
      }
    }),
  )
})

export const upsertThreadSummary = Effect.fn('threadStateDb.upsertThreadSummary')(function* (
  session: SessionSummaryRecord,
) {
  const sql = yield* SqlClient.SqlClient
  yield* ensureProject(session.cwd)

  const storedThreadForPath = yield* getStoredThreadRowForPath(session.sessionPath)
  const storedDuplicateIdRows = yield* getStoredDuplicateThreadRows(session)

  const threadId =
    storedThreadForPath?.id && storedThreadForPath.id !== session.id
      ? storedThreadForPath.id
      : storedDuplicateIdRows.length > 0
        ? getDisambiguatedThreadId(session)
        : session.id

  yield* upsertThreadSummaryStatement(sql, threadId, session)

  return threadId
})
