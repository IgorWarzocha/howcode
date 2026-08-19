import { getThreadStateDatabase } from './db.ts'

export type ProjectWorktreeSource = 'howcode' | 'imported'

export type ProjectWorktreeMetadata = {
  cwd: string
  rootCwd: string
  branchName: string | null
  parentBranchName?: string | null | undefined
  isMain: boolean
  source: ProjectWorktreeSource
}

export type StoredProjectWorktree = ProjectWorktreeMetadata & {
  completed: boolean
}

export function getProjectWorktree(cwd: string): StoredProjectWorktree | null {
  const row = getThreadStateDatabase()
    .prepare(
      `
        SELECT
          cwd,
          root_cwd AS rootCwd,
          branch_name AS branchName,
          parent_branch_name AS parentBranchName,
          is_main AS isMain,
          source,
          completed
        FROM project_worktrees
        WHERE cwd = ?
      `,
    )
    .get(cwd) as
    | {
        cwd?: unknown
        rootCwd?: unknown
        branchName?: unknown
        parentBranchName?: unknown
        isMain?: unknown
        source?: unknown
        completed?: unknown
      }
    | undefined

  if (!row) return null
  if (
    typeof row.cwd !== 'string' ||
    typeof row.rootCwd !== 'string' ||
    !(row.branchName === null || typeof row.branchName === 'string') ||
    !(row.parentBranchName === null || typeof row.parentBranchName === 'string') ||
    typeof row.isMain !== 'number' ||
    (row.source !== 'howcode' && row.source !== 'imported') ||
    typeof row.completed !== 'number'
  ) {
    throw new Error(`Invalid persisted worktree metadata for ${cwd}.`)
  }

  return {
    cwd: row.cwd,
    rootCwd: row.rootCwd,
    branchName: row.branchName,
    parentBranchName: row.parentBranchName,
    isMain: row.isMain !== 0,
    source: row.source,
    completed: row.completed !== 0,
  }
}

export function getProjectWorktreeDirectory(rootCwd: string) {
  const db = getThreadStateDatabase()
  const row = db
    .prepare(
      `
        SELECT worktree_dir AS worktreeDir
        FROM project_worktree_settings
        WHERE root_cwd = ?
      `,
    )
    .get(rootCwd) as { worktreeDir?: string | undefined } | undefined

  return row?.worktreeDir?.trim() || './.worktrees'
}

export function setProjectWorktreeDirectory(rootCwd: string, worktreeDirectory: string) {
  const normalizedWorktreeDirectory = worktreeDirectory.trim() || './.worktrees'
  const db = getThreadStateDatabase()
  db.prepare(
    `
      INSERT INTO project_worktree_settings (root_cwd, worktree_dir)
      VALUES (?, ?)
      ON CONFLICT(root_cwd) DO UPDATE SET
        worktree_dir = excluded.worktree_dir,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(rootCwd, normalizedWorktreeDirectory)
}

export function upsertProjectWorktree(metadata: ProjectWorktreeMetadata) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      INSERT INTO project_worktrees (cwd, root_cwd, branch_name, parent_branch_name, is_main, source)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(cwd) DO UPDATE SET
        root_cwd = excluded.root_cwd,
        branch_name = excluded.branch_name,
        parent_branch_name = COALESCE(excluded.parent_branch_name, project_worktrees.parent_branch_name),
        is_main = excluded.is_main,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(
    metadata.cwd,
    metadata.rootCwd,
    metadata.branchName,
    metadata.parentBranchName ?? null,
    metadata.isMain ? 1 : 0,
    metadata.source,
  )

  if (!metadata.isMain && metadata.branchName) {
    db.prepare(
      `
        UPDATE threads
        SET branch_name = COALESCE(branch_name, ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE cwd = ?
      `,
    ).run(metadata.branchName, metadata.cwd)
  }
}

export function setProjectWorktreeCompleted(cwd: string, completed: boolean) {
  const db = getThreadStateDatabase()
  const result = db
    .prepare(
      `
      UPDATE project_worktrees
      SET completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ? AND is_main = 0
    `,
    )
    .run(completed ? 1 : 0, cwd) as { changes?: unknown }
  if (typeof result.changes !== 'number') {
    throw new Error(`Invalid worktree completion update result for ${cwd}.`)
  }
  return result.changes > 0
}

export function listProjectBranchWorktreePaths(rootCwd: string, branchName: string) {
  const rows = getThreadStateDatabase()
    .prepare(
      `
        SELECT cwd
        FROM project_worktrees
        WHERE root_cwd = ?
          AND is_main = 0
          AND COALESCE(
            NULLIF(TRIM(parent_branch_name), ''),
            NULLIF(TRIM(branch_name), '')
          ) = ?
      `,
    )
    .all(rootCwd, branchName) as Array<{ cwd?: unknown }>

  return rows.map((row) => {
    if (typeof row.cwd !== 'string') {
      throw new Error(`Invalid persisted worktree path under ${rootCwd}.`)
    }
    return row.cwd
  })
}

export function deleteProjectWorktreeMetadata(cwd: string) {
  const db = getThreadStateDatabase()
  db.prepare(
    `
      DELETE FROM project_worktrees
      WHERE cwd = ?
    `,
  ).run(cwd)
}
