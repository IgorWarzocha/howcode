import * as Schema from 'effect/Schema'
import type { WorkingDirectory } from '../../../../shared/desktop-contracts.ts'
export const DirectoryRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  pinned: Schema.Number,
  collapsed: Schema.Number,
  chatCount: Schema.Number,
  latestModifiedMs: Schema.Number,
  repoOriginUrl: Schema.NullOr(Schema.String),
  repoOriginChecked: Schema.Number,
  gitOpsMode: Schema.NullOr(Schema.String),
  worktreeRootDirectoryId: Schema.NullOr(Schema.String),
  worktreeBranchName: Schema.NullOr(Schema.String),
  worktreeParentBranchName: Schema.NullOr(Schema.String),
  worktreeIsMain: Schema.NullOr(Schema.Number),
  worktreeSource: Schema.NullOr(Schema.String),
  worktreeCompleted: Schema.NullOr(Schema.Number),
  worktreeDirectory: Schema.NullOr(Schema.String),
})

export type DirectoryRow = typeof DirectoryRowSchema.Type

export function mapDirectoryRow(row: DirectoryRow): WorkingDirectory {
  return {
    id: row.id,
    name: row.name,
    chats: [],
    latestModifiedMs: row.latestModifiedMs,
    pinned: Boolean(row.pinned),
    chatCount: row.chatCount,
    chatsLoaded: false,
    collapsed: Boolean(row.collapsed),
    repoOriginUrl: row.repoOriginUrl,
    repoOriginChecked: Boolean(row.repoOriginChecked),
    worktreeDirectory: row.worktreeDirectory ?? './.worktrees',
    worktree: row.worktreeRootDirectoryId
      ? {
          rootDirectoryId: row.worktreeRootDirectoryId,
          branchName: row.worktreeBranchName,
          parentBranchName: row.worktreeParentBranchName,
          isMain: Boolean(row.worktreeIsMain),
          source: row.worktreeSource === 'imported' ? 'imported' : 'howcode',
          completed: Boolean(row.worktreeCompleted),
        }
      : undefined,
  }
}
