import { Effect } from 'effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { ensureDirectory } from '../../../../desktop/chat-repository/conversation-scopes.ts'
import { withDatabaseTransaction } from '../../../../desktop/chat-repository/write-transaction.ts'

export type DirectoryWorktreeSource = 'howcode' | 'imported'

export type DirectoryWorktreeMetadata = {
  cwd: string
  rootCwd: string
  branchName: string | null
  parentBranchName?: string | null | undefined
  gitCommonDirectoryIdentity: string | null
  isMain: boolean
  source: DirectoryWorktreeSource
}

export type StoredDirectoryWorktree = DirectoryWorktreeMetadata & {
  completed: boolean
}

export type RegisterManagedWorktreeInput = {
  branchName: string
  gitCommonDirectoryIdentity: string | null
  parentBranchName: string
  directoryId: string
  rootDirectoryId: string
}

export const getDirectoryWorktree = Effect.fn('chatRepository.getDirectoryWorktree')(function* (
  cwd: string,
) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<{
    cwd?: unknown
    rootCwd?: unknown
    branchName?: unknown
    parentBranchName?: unknown
    gitCommonDirectoryIdentity?: unknown
    isMain?: unknown
    source?: unknown
    completed?: unknown
  }>(
    `
        SELECT
          cwd,
          root_cwd AS rootCwd,
          branch_name AS branchName,
          parent_branch_name AS parentBranchName,
          git_common_dir_identity AS gitCommonDirectoryIdentity,
          is_main AS isMain,
          source,
          completed
        FROM project_worktrees
        WHERE cwd = ?
      `,
    [cwd],
  ))[0]

  if (!row) return null
  if (
    typeof row.cwd !== 'string' ||
    typeof row.rootCwd !== 'string' ||
    !(row.branchName === null || typeof row.branchName === 'string') ||
    !(row.parentBranchName === null || typeof row.parentBranchName === 'string') ||
    !(
      row.gitCommonDirectoryIdentity === null || typeof row.gitCommonDirectoryIdentity === 'string'
    ) ||
    typeof row.isMain !== 'number' ||
    (row.source !== 'howcode' && row.source !== 'imported') ||
    typeof row.completed !== 'number'
  ) {
    throw new Error(`Invalid persisted worktree metadata for ${cwd}.`)
  }

  const worktree: StoredDirectoryWorktree = {
    cwd: row.cwd,
    rootCwd: row.rootCwd,
    branchName: row.branchName,
    parentBranchName: row.parentBranchName,
    gitCommonDirectoryIdentity: row.gitCommonDirectoryIdentity,
    isMain: row.isMain !== 0,
    source: row.source,
    completed: row.completed !== 0,
  }
  return worktree
})

export const getDirectoryWorktreeDirectory = Effect.fn(
  'chatRepository.getDirectoryWorktreeDirectory',
)(function* (rootCwd: string) {
  const sql = yield* SqlClient.SqlClient
  const row = (yield* sql.unsafe<{ worktreeDir?: string | undefined }>(
    `
        SELECT worktree_dir AS worktreeDir
        FROM project_worktree_settings
        WHERE root_cwd = ?
      `,
    [rootCwd],
  ))[0]

  return row?.worktreeDir?.trim() || './.worktrees'
})

export const setDirectoryWorktreeDirectory = Effect.fn(
  'chatRepository.setDirectoryWorktreeDirectory',
)(function* (rootCwd: string, worktreeDirectory: string) {
  const normalizedWorktreeDirectory = worktreeDirectory.trim() || './.worktrees'
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      INSERT INTO project_worktree_settings (root_cwd, worktree_dir)
      VALUES (?, ?)
      ON CONFLICT(root_cwd) DO UPDATE SET
        worktree_dir = excluded.worktree_dir,
        updated_at = CURRENT_TIMESTAMP
    `,
    [rootCwd, normalizedWorktreeDirectory],
  )
})

export const upsertDirectoryWorktree = Effect.fn('chatRepository.upsertDirectoryWorktree')(
  function* (metadata: DirectoryWorktreeMetadata) {
    const sql = yield* SqlClient.SqlClient
    yield* sql.unsafe(
      `
      INSERT INTO project_worktrees (
        cwd,
        root_cwd,
        branch_name,
        parent_branch_name,
        git_common_dir_identity,
        is_main,
        source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cwd) DO UPDATE SET
        root_cwd = excluded.root_cwd,
        branch_name = excluded.branch_name,
        git_common_dir_identity = COALESCE(
          project_worktrees.git_common_dir_identity,
          excluded.git_common_dir_identity
        ),
        parent_branch_name = CASE
          WHEN excluded.parent_branch_name IS NOT NULL THEN excluded.parent_branch_name
          WHEN project_worktrees.root_cwd IS excluded.root_cwd
            AND project_worktrees.branch_name IS excluded.branch_name
            AND (
              project_worktrees.git_common_dir_identity IS NULL
              OR excluded.git_common_dir_identity IS NULL
              OR project_worktrees.git_common_dir_identity IS excluded.git_common_dir_identity
            )
            AND project_worktrees.source IS excluded.source
            THEN project_worktrees.parent_branch_name
          ELSE NULL
        END,
        is_main = excluded.is_main,
        source = excluded.source,
        completed = CASE
          WHEN project_worktrees.root_cwd IS excluded.root_cwd
            AND project_worktrees.branch_name IS excluded.branch_name
            AND (
              project_worktrees.git_common_dir_identity IS NULL
              OR excluded.git_common_dir_identity IS NULL
              OR project_worktrees.git_common_dir_identity IS excluded.git_common_dir_identity
            )
            AND project_worktrees.is_main IS excluded.is_main
            AND project_worktrees.source IS excluded.source
            AND (
              excluded.parent_branch_name IS NULL
              OR project_worktrees.parent_branch_name IS excluded.parent_branch_name
            )
            THEN project_worktrees.completed
          ELSE 0
        END,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        metadata.cwd,
        metadata.rootCwd,
        metadata.branchName,
        metadata.parentBranchName ?? null,
        metadata.gitCommonDirectoryIdentity,
        metadata.isMain ? 1 : 0,
        metadata.source,
      ],
    )

    if (!metadata.isMain && metadata.branchName) {
      yield* sql.unsafe(
        `
        UPDATE conversation_facts
        SET branch_name = COALESCE(branch_name, ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE cwd = ?
      `,
        [metadata.branchName, metadata.cwd],
      )
    }
  },
)

export const setDirectoryWorktreeCompleted = Effect.fn(
  'chatRepository.setDirectoryWorktreeCompleted',
)(function* (cwd: string, completed: boolean) {
  const sql = yield* SqlClient.SqlClient
  const result = yield* sql.unsafe(
    `
      UPDATE project_worktrees
      SET completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE cwd = ? AND is_main = 0
    `,
    [completed ? 1 : 0, cwd],
  ).raw
  if (
    typeof result !== 'object' ||
    result === null ||
    !('changes' in result) ||
    typeof result.changes !== 'number'
  ) {
    throw new Error(`Invalid worktree completion update result for ${cwd}.`)
  }
  return result.changes > 0
})

export const listDirectoryWorktreePaths = Effect.fn('chatRepository.listDirectoryWorktreePaths')(
  function* (rootCwd: string) {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql.unsafe<{ cwd?: unknown }>(
      `
        SELECT cwd
        FROM project_worktrees
        WHERE root_cwd = ?
          AND is_main = 0
      `,
      [rootCwd],
    )

    return rows.map((row) => {
      if (typeof row.cwd !== 'string') {
        throw new Error(`Invalid persisted worktree path under ${rootCwd}.`)
      }
      return row.cwd
    })
  },
)

export const deleteDirectoryWorktreeMetadata = Effect.fn(
  'chatRepository.deleteDirectoryWorktreeMetadata',
)(function* (cwd: string) {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(
    `
      DELETE FROM project_worktrees
      WHERE cwd = ?
    `,
    [cwd],
  )
})

export const registerManagedWorktree = Effect.fn('chatRepository.registerManagedWorktree')(
  function* (input: RegisterManagedWorktreeInput) {
    yield* withDatabaseTransaction(
      Effect.gen(function* () {
        yield* ensureDirectory(input.rootDirectoryId)
        yield* ensureDirectory(input.directoryId)
        yield* upsertDirectoryWorktree({
          cwd: input.rootDirectoryId,
          rootCwd: input.rootDirectoryId,
          branchName: null,
          gitCommonDirectoryIdentity: input.gitCommonDirectoryIdentity,
          isMain: true,
          source: 'howcode',
        })
        yield* upsertDirectoryWorktree({
          cwd: input.directoryId,
          rootCwd: input.rootDirectoryId,
          branchName: input.branchName,
          parentBranchName: input.parentBranchName,
          gitCommonDirectoryIdentity: input.gitCommonDirectoryIdentity,
          isMain: false,
          source: 'howcode',
        })
      }),
    )
  },
)
