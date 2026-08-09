import * as Schema from 'effect/Schema'
import { ComposerStateSchema, PiExtensionUiStateSchema } from './desktop-composer-schema'
import type { ProjectDiffStreamEvent } from './desktop-project-git-contracts'
import { ThreadDataSchema } from './desktop-thread-schema'
import { isKeybindingCommandId, type KeybindingCommandId } from './keybindings'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProjectDiffStreamEvent(value: unknown): value is ProjectDiffStreamEvent {
  if (!isRecord(value)) return false
  const { chunk, error, projectId, result, sequence, streamId, type } = value
  if (typeof streamId !== 'string' || typeof projectId !== 'string') return false
  if (type === 'chunk') return typeof sequence === 'number' && typeof chunk === 'string'
  if (type === 'complete') return result === null || isRecord(result)
  return type === 'error' && typeof error === 'string'
}

const AppUpdateStateSchema = Schema.Struct({
  status: Schema.Literals([
    'idle',
    'checking',
    'up-to-date',
    'available',
    'downloading',
    'installing',
    'ready',
    'restarting',
    'error',
  ]),
  currentVersion: Schema.String,
  latestVersion: Schema.NullOr(Schema.String),
  channel: Schema.NullOr(Schema.Literals(['main', 'dev'])),
  error: Schema.NullOr(Schema.String),
})

const ArtifactSchema = Schema.Struct({
  slug: Schema.String,
  conversationId: Schema.String,
  kind: Schema.Literals(['html', 'react', 'markdown']),
  content: Schema.String,
  version: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const ProjectDiffStreamEventSchema = Schema.declare<ProjectDiffStreamEvent>(
  isProjectDiffStreamEvent,
  { identifier: 'ProjectDiffStreamEvent' },
)
const KeybindingCommandIdSchema = Schema.declare<KeybindingCommandId>(isKeybindingCommandId, {
  identifier: 'KeybindingCommandId',
})

/** Runtime decoder for DesktopEvent values received across process boundaries. */
export const DesktopEventSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('app-update'), state: AppUpdateStateSchema }),
  Schema.Struct({ type: Schema.Literal('shell-state-refresh') }),
  Schema.Struct({
    type: Schema.Literal('keybinding-command'),
    commandId: KeybindingCommandIdSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('dictation-download-log'),
    modelId: Schema.Literals(['tiny.en', 'base.en', 'small.en']),
    message: Schema.String,
    at: Schema.String,
    done: Schema.Boolean,
    isError: Schema.Boolean,
  }),
  Schema.Struct({
    type: Schema.Literal('project-diff-stream'),
    event: ProjectDiffStreamEventSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('runtime-diagnostic'),
    severity: Schema.Literals(['info', 'warning', 'error']),
    message: Schema.String,
    details: Schema.optionalKey(Schema.Unknown),
    sessionPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
    projectId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  }),
  Schema.Struct({ type: Schema.Literal('internal-thread-update'), sessionPath: Schema.String }),
  Schema.Struct({ type: Schema.Literal('session-tree-refresh'), sessionPath: Schema.String }),
  Schema.Struct({
    type: Schema.Literal('artifact-update'),
    conversationId: Schema.String,
    artifact: ArtifactSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('thread-update'),
    reason: Schema.Literals([
      'start',
      'update',
      'end',
      'external',
      'compaction-start',
      'compaction',
    ]),
    projectId: Schema.String,
    threadId: Schema.String,
    sessionPath: Schema.String,
    branchName: Schema.optionalKey(Schema.NullOr(Schema.String)),
    replacesSessionPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
    chatGroupId: Schema.optionalKey(Schema.NullOr(Schema.String)),
    isChat: Schema.optionalKey(Schema.Boolean),
    thread: ThreadDataSchema,
    composer: Schema.NullOr(ComposerStateSchema),
  }),
  Schema.Struct({
    type: Schema.Literal('composer-update'),
    projectId: Schema.NullOr(Schema.String),
    sessionPath: Schema.NullOr(Schema.String),
    composer: ComposerStateSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('pi-extension-ui-update'),
    projectId: Schema.NullOr(Schema.String),
    sessionPath: Schema.String,
    extensionUi: PiExtensionUiStateSchema,
  }),
]).pipe(Schema.toTaggedUnion('type'))
