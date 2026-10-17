import type { DirectoryDiffStreamEvent } from '@howaboua/howcode-git/contracts'
import * as Schema from 'effect/Schema'
import { ChatDataSchema } from './desktop-chat-schema'
import { ComposerStateSchema } from './desktop-composer-schema'
import { isKeybindingCommandId, type KeybindingCommandId } from './keybindings'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDirectoryDiffStreamEvent(value: unknown): value is DirectoryDiffStreamEvent {
  if (!isRecord(value)) return false
  const { chunk, error, directoryId, result, sequence, streamId, type } = value
  if (typeof streamId !== 'string' || typeof directoryId !== 'string') return false
  if (type === 'chunk') return typeof sequence === 'number' && typeof chunk === 'string'
  if (type === 'complete') return result === null || isRecord(result)
  return type === 'error' && typeof error === 'string'
}

const DirectoryDiffStreamEventSchema = Schema.declare<DirectoryDiffStreamEvent>(
  isDirectoryDiffStreamEvent,
  { identifier: 'DirectoryDiffStreamEvent' },
)
const KeybindingCommandIdSchema = Schema.declare<KeybindingCommandId>(isKeybindingCommandId, {
  identifier: 'KeybindingCommandId',
})

/** Runtime decoder for DesktopEvent values received across process boundaries. */
export const DesktopEventSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('workspace-layout-changed'),
    conversationId: Schema.String,
    revision: Schema.Number,
  }),
  Schema.Struct({ type: Schema.Literal('package-ui-invalidation') }),
  Schema.Struct({ type: Schema.Literal('terminal-runtime-changed'), available: Schema.Boolean }),
  Schema.Struct({
    type: Schema.Literal('plugin-event'),
    plugin: Schema.String,
    event: Schema.Unknown,
  }),
  Schema.Struct({ type: Schema.Literal('shell-state-refresh') }),
  Schema.Struct({
    type: Schema.Literal('keybinding-command'),
    commandId: KeybindingCommandIdSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('directory-diff-stream'),
    event: DirectoryDiffStreamEventSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('runtime-diagnostic'),
    severity: Schema.Literals(['info', 'warning', 'error']),
    message: Schema.String,
    details: Schema.optionalKey(Schema.Unknown),
    conversationId: Schema.optionalKey(Schema.NullOr(Schema.String)),
    directoryId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  }),
  Schema.Struct({ type: Schema.Literal('internal-chat-update'), conversationId: Schema.String }),
  Schema.Struct({
    type: Schema.Literal('chat-update'),
    reason: Schema.Literals([
      'start',
      'update',
      'end',
      'external',
      'compaction-start',
      'compaction',
    ]),
    directoryId: Schema.String,
    chatId: Schema.String,
    conversationId: Schema.String,
    branchName: Schema.optionalKey(Schema.NullOr(Schema.String)),
    replacesConversationId: Schema.optionalKey(Schema.NullOr(Schema.String)),
    workspaceId: Schema.optionalKey(Schema.NullOr(Schema.String)),
    chat: ChatDataSchema,
    composer: Schema.NullOr(ComposerStateSchema),
  }),
  Schema.Struct({
    type: Schema.Literal('composer-update'),
    directoryId: Schema.NullOr(Schema.String),
    conversationId: Schema.NullOr(Schema.String),
    composer: ComposerStateSchema,
  }),
]).pipe(Schema.toTaggedUnion('type'))
