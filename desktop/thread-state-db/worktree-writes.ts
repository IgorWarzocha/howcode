import { getThreadStateDatabase } from './db.ts'

export type ProjectWorktreeSource = 'howcode' | 'imported'

export type ProjectWorktreeMetadata = {
  cwd: string
  rootCwd: string
  branchName: string | null
  isMain: boolean
  source: ProjectWorktreeSource
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
      INSERT INTO project_worktrees (cwd, root_cwd, branch_name, is_main, source)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cwd) DO UPDATE SET
        root_cwd = excluded.root_cwd,
        branch_name = excluded.branch_name,
        is_main = excluded.is_main,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(
    metadata.cwd,
    metadata.rootCwd,
    metadata.branchName,
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
