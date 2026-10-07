import * as Schema from 'effect/Schema'
import type { Project } from '../../../../shared/desktop-contracts.ts'
export const ProjectRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  pinned: Schema.Number,
  collapsed: Schema.Number,
  threadCount: Schema.Number,
  latestModifiedMs: Schema.Number,
  repoOriginUrl: Schema.NullOr(Schema.String),
  repoOriginChecked: Schema.Number,
  gitOpsMode: Schema.NullOr(Schema.String),
  worktreeRootProjectId: Schema.NullOr(Schema.String),
  worktreeBranchName: Schema.NullOr(Schema.String),
  worktreeParentBranchName: Schema.NullOr(Schema.String),
  worktreeIsMain: Schema.NullOr(Schema.Number),
  worktreeSource: Schema.NullOr(Schema.String),
  worktreeCompleted: Schema.NullOr(Schema.Number),
  worktreeDirectory: Schema.NullOr(Schema.String),
})

export type ProjectRow = typeof ProjectRowSchema.Type

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    threads: [],
    latestModifiedMs: row.latestModifiedMs,
    pinned: Boolean(row.pinned),
    threadCount: row.threadCount,
    threadsLoaded: false,
    collapsed: Boolean(row.collapsed),
    repoOriginUrl: row.repoOriginUrl,
    repoOriginChecked: Boolean(row.repoOriginChecked),
    worktreeDirectory: row.worktreeDirectory ?? './.worktrees',
    worktree: row.worktreeRootProjectId
      ? {
          rootProjectId: row.worktreeRootProjectId,
          branchName: row.worktreeBranchName,
          parentBranchName: row.worktreeParentBranchName,
          isMain: Boolean(row.worktreeIsMain),
          source: row.worktreeSource === 'imported' ? 'imported' : 'howcode',
          completed: Boolean(row.worktreeCompleted),
        }
      : undefined,
  }
}
