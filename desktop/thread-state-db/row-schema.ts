import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'

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

export const ThreadRowSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  sessionPath: Schema.String,
  summary: Schema.NullOr(Schema.String),
  running: Schema.Number,
  unread: Schema.Number,
  pinned: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  lastModifiedMs: Schema.Number,
})

export const InboxThreadRowSchema = Schema.Struct({
  threadId: Schema.String,
  title: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  sessionPath: Schema.String,
  lastUserPrompt: Schema.NullOr(Schema.String),
  lastAssistantMessageJson: Schema.NullOr(Schema.String),
  lastAssistantPreview: Schema.NullOr(Schema.String),
  running: Schema.Number,
  unread: Schema.Number,
  branchName: Schema.NullOr(Schema.String),
  lastActivityMs: Schema.Number,
  isChat: Schema.Number,
})

export const ArchivedThreadRowSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  sessionPath: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  lastModifiedMs: Schema.Number,
  isChat: Schema.Number,
})

export function decodePersistedRow<A>(
  schema: Schema.ConstraintDecoder<A>,
  row: unknown,
  label: string,
) {
  const decoded = Schema.decodeUnknownResult(schema)(row)
  if (Result.isFailure(decoded)) {
    throw new Error(`Invalid persisted ${label} row: ${decoded.failure}`)
  }
  return decoded.success
}

export function decodePersistedRows<A>(
  schema: Schema.ConstraintDecoder<A>,
  rows: readonly unknown[],
  label: string,
) {
  return rows.map((row) => decodePersistedRow(schema, row, label))
}
