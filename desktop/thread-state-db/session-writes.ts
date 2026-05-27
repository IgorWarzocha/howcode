import { createHash } from 'node:crypto'
import path from 'node:path'
import { getThreadStateDatabase } from './db.ts'
import { ensureProject } from './project-writes.ts'
import type { SessionSummaryRecord } from './types.ts'
import { runInTransaction } from './write-transaction.ts'

type ThreadIdPathRow = {
  id?: string | undefined
  sessionPath: string
}

const worktreeBranchForCwdSql = `
  SELECT branch_name
  FROM project_worktrees
  WHERE cwd = ? AND is_main = 0
`

function getSessionBranchName(session: SessionSummaryRecord) {
  return session.branchName?.trim() || null
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function getDisambiguatedThreadId(session: SessionSummaryRecord) {
  const suffix = createHash('sha1').update(session.sessionPath).digest('hex').slice(0, 8)
  return `${session.id}:${suffix}`
}

function getStoredDuplicateThreadRows(
  db: ReturnType<typeof getThreadStateDatabase>,
  session: SessionSummaryRecord,
) {
  return db
    .prepare(
      `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE (id = ? OR id LIKE ? ESCAPE '\\')
          AND session_path != ?
      `,
    )
    .all(session.id, `${escapeLikePattern(session.id)}:%`, session.sessionPath) as ThreadIdPathRow[]
}

function getStoredThreadRowForPath(
  db: ReturnType<typeof getThreadStateDatabase>,
  sessionPath: string,
) {
  return db
    .prepare(
      `
        SELECT id, session_path AS sessionPath
        FROM threads
        WHERE session_path = ?
      `,
    )
    .get(sessionPath) as ThreadIdPathRow | undefined
}

function getIndexedSessionThreadId(
  db: ReturnType<typeof getThreadStateDatabase>,
  session: SessionSummaryRecord,
  duplicateSessionIds: Set<string>,
) {
  const storedThreadForPath = getStoredThreadRowForPath(db, session.sessionPath)
  if (storedThreadForPath?.id && storedThreadForPath.id !== session.id) {
    return storedThreadForPath.id
  }

  if (duplicateSessionIds.has(session.id)) return getDisambiguatedThreadId(session)
  return getStoredDuplicateThreadRows(db, session).length > 0
    ? getDisambiguatedThreadId(session)
    : session.id
}

function getDuplicateSessionIds(sessions: SessionSummaryRecord[]) {
  const sessionPathsById = new Map<string, Set<string>>()

  for (const session of sessions) {
    const sessionPaths = sessionPathsById.get(session.id) ?? new Set<string>()
    sessionPaths.add(session.sessionPath)
    sessionPathsById.set(session.id, sessionPaths)
  }

  return new Set(
    [...sessionPathsById.entries()]
      .filter(([, sessionPaths]) => sessionPaths.size > 1)
      .map(([sessionId]) => sessionId),
  )
}

export function syncSessionSummaries(cwd: string, sessions: SessionSummaryRecord[]) {
  const db = getThreadStateDatabase()
  const insertProject = db.prepare(
    `
      INSERT INTO projects (cwd, name, collapsed, hidden)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(cwd) DO UPDATE SET
        name = excluded.name,
        updated_at = CURRENT_TIMESTAMP
    `,
  )
  const insertThread = db.prepare(
    `
      INSERT INTO threads (id, cwd, session_path, title, last_modified_ms, branch_name)
      VALUES (?, ?, ?, ?, ?, COALESCE(?, (${worktreeBranchForCwdSql})))
      ON CONFLICT(session_path) DO UPDATE SET
        id = excluded.id,
        cwd = excluded.cwd,
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        branch_name = COALESCE(threads.branch_name, excluded.branch_name),
        updated_at = CURRENT_TIMESTAMP
    `,
  )
  ensureProject(cwd)
  runInTransaction(db, () => {
    const duplicateSessionIds = getDuplicateSessionIds(sessions)

    for (const session of sessions) {
      insertProject.run(session.cwd, path.basename(session.cwd) || session.cwd)
      const threadId = getIndexedSessionThreadId(db, session, duplicateSessionIds)

      insertThread.run(
        threadId,
        session.cwd,
        session.sessionPath,
        session.title,
        session.lastModifiedMs,
        getSessionBranchName(session),
        session.cwd,
      )
    }
  })
}

export function upsertThreadSummary(session: SessionSummaryRecord) {
  const db = getThreadStateDatabase()
  ensureProject(session.cwd)

  const storedThreadForPath = getStoredThreadRowForPath(db, session.sessionPath)
  const storedDuplicateIdRows = getStoredDuplicateThreadRows(db, session)

  const threadId =
    storedThreadForPath?.id && storedThreadForPath.id !== session.id
      ? storedThreadForPath.id
      : storedDuplicateIdRows.length > 0
        ? getDisambiguatedThreadId(session)
        : session.id

  db.prepare(
    `
      INSERT INTO threads (id, cwd, session_path, title, last_modified_ms, branch_name)
      VALUES (?, ?, ?, ?, ?, COALESCE(?, (${worktreeBranchForCwdSql})))
      ON CONFLICT(session_path) DO UPDATE SET
        id = excluded.id,
        cwd = excluded.cwd,
        title = excluded.title,
        last_modified_ms = excluded.last_modified_ms,
        branch_name = COALESCE(threads.branch_name, excluded.branch_name),
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(
    threadId,
    session.cwd,
    session.sessionPath,
    session.title,
    session.lastModifiedMs,
    getSessionBranchName(session),
    session.cwd,
  )

  return threadId
}

export function setSessionNativeExtensions(sessionPath: string, enabled: string[]) {
  const db = getThreadStateDatabase()
  const normalized = [...new Set(enabled.map((item) => item.trim()).filter(Boolean))]
  db.prepare(
    `
      INSERT INTO session_native_extensions (session_path, enabled_json)
      VALUES (?, ?)
      ON CONFLICT(session_path) DO UPDATE SET
        enabled_json = excluded.enabled_json,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(sessionPath, JSON.stringify(normalized))
}
