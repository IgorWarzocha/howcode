import * as Schema from 'effect/Schema'

const TerminalIdentifier = Schema.String.check(Schema.isNonEmpty())
const TerminalColumns = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
const TerminalRows = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))

export const TerminalStatus = Schema.Literals(['starting', 'running', 'exited', 'error'])
export type TerminalStatus = typeof TerminalStatus.Type

export const TerminalOpenRequest = Schema.Struct({
  projectId: TerminalIdentifier,
  sessionPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  cwd: Schema.optionalKey(Schema.NullOr(Schema.String)),
  launchMode: Schema.optionalKey(Schema.Literals(['shell', 'pi-session'])),
  cols: TerminalColumns,
  rows: TerminalRows,
  env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
})
export interface TerminalOpenRequest extends Schema.Schema.Type<typeof TerminalOpenRequest> {}

export const TerminalWriteRequest = Schema.Struct({
  sessionId: TerminalIdentifier,
  data: Schema.String,
})
export interface TerminalWriteRequest extends Schema.Schema.Type<typeof TerminalWriteRequest> {}

export const TerminalResizeRequest = Schema.Struct({
  sessionId: TerminalIdentifier,
  cols: TerminalColumns,
  rows: TerminalRows,
})
export interface TerminalResizeRequest extends Schema.Schema.Type<typeof TerminalResizeRequest> {}

export const TerminalCloseRequest = Schema.Struct({
  sessionId: TerminalIdentifier,
  deleteHistory: Schema.optionalKey(Schema.Boolean),
  force: Schema.optionalKey(Schema.Boolean),
})
export interface TerminalCloseRequest extends Schema.Schema.Type<typeof TerminalCloseRequest> {}

export const TerminalSessionFileStatRequest = Schema.Struct({
  sessionId: TerminalIdentifier,
})
export interface TerminalSessionFileStatRequest
  extends Schema.Schema.Type<typeof TerminalSessionFileStatRequest> {}

export const TerminalSessionFileStat = Schema.Struct({
  mtimeMs: Schema.Number,
  size: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
})
export interface TerminalSessionFileStat
  extends Schema.Schema.Type<typeof TerminalSessionFileStat> {}

export const TerminalStatusRequest = Schema.Struct({
  sessionId: TerminalIdentifier,
})
export interface TerminalStatusRequest extends Schema.Schema.Type<typeof TerminalStatusRequest> {}

const PresentTerminalStatusSnapshot = Schema.Struct({
  sessionId: TerminalIdentifier,
  status: TerminalStatus,
})

export const TerminalStatusSnapshot = Schema.NullOr(PresentTerminalStatusSnapshot)
export type TerminalStatusSnapshot = typeof TerminalStatusSnapshot.Type

export const TerminalSessionSnapshot = Schema.Struct({
  sessionId: TerminalIdentifier,
  projectId: TerminalIdentifier,
  sessionPath: Schema.NullOr(Schema.String),
  cwd: Schema.String,
  launchMode: Schema.Literals(['shell', 'pi-session']),
  status: TerminalStatus,
  pid: Schema.NullOr(Schema.Int),
  cols: TerminalColumns,
  rows: TerminalRows,
  history: Schema.String,
  hasVisibleContent: Schema.Boolean,
  exitCode: Schema.NullOr(Schema.Int),
  exitSignal: Schema.NullOr(Schema.Int),
  updatedAt: Schema.String,
})
export interface TerminalSessionSnapshot
  extends Schema.Schema.Type<typeof TerminalSessionSnapshot> {}

const TerminalEventBase = {
  sessionId: TerminalIdentifier,
  createdAt: Schema.String,
}

const TerminalStartedEventVariant = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('started'),
  snapshot: TerminalSessionSnapshot,
})

const TerminalRestartedEventVariant = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('restarted'),
  snapshot: TerminalSessionSnapshot,
})

export const TerminalStartedEvent = Schema.Union([
  TerminalStartedEventVariant,
  TerminalRestartedEventVariant,
])
export type TerminalStartedEvent = typeof TerminalStartedEvent.Type

export const TerminalOutputEvent = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('output'),
  data: Schema.String,
})
export interface TerminalOutputEvent extends Schema.Schema.Type<typeof TerminalOutputEvent> {}

export const TerminalUpdatedEvent = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('updated'),
  snapshot: TerminalSessionSnapshot,
})
export interface TerminalUpdatedEvent extends Schema.Schema.Type<typeof TerminalUpdatedEvent> {}

export const TerminalExitedEvent = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('exited'),
  exitCode: Schema.NullOr(Schema.Int),
  exitSignal: Schema.NullOr(Schema.Int),
})
export interface TerminalExitedEvent extends Schema.Schema.Type<typeof TerminalExitedEvent> {}

export const TerminalErrorEvent = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('error'),
  message: Schema.String,
})
export interface TerminalErrorEvent extends Schema.Schema.Type<typeof TerminalErrorEvent> {}

export const TerminalClearedEvent = Schema.Struct({
  ...TerminalEventBase,
  type: Schema.Literal('cleared'),
  snapshot: TerminalSessionSnapshot,
})
export interface TerminalClearedEvent extends Schema.Schema.Type<typeof TerminalClearedEvent> {}

export const TerminalEvent = Schema.Union([
  TerminalStartedEvent,
  TerminalUpdatedEvent,
  TerminalOutputEvent,
  TerminalExitedEvent,
  TerminalErrorEvent,
  TerminalClearedEvent,
]).pipe(Schema.toTaggedUnion('type'))
export type TerminalEvent = typeof TerminalEvent.Type

export const TerminalOperation = Schema.Literals([
  'list',
  'open',
  'write',
  'resize',
  'close',
  'closeAll',
  'statSessionFile',
  'status',
  'subscribeEvents',
])
export type TerminalOperation = typeof TerminalOperation.Type

export class TerminalError extends Schema.TaggedError<TerminalError>()('TerminalError', {
  operation: TerminalOperation,
  message: Schema.String,
}) {}
