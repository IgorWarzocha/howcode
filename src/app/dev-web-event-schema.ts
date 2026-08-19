import * as Schema from 'effect/Schema'
import { DesktopEventSchema } from '../../shared/desktop-event-schema'
import { TerminalEvent } from '../../shared/terminal-contracts'

export const DevWebDesktopEventEnvelope = Schema.Struct({
  channel: Schema.Literal('desktopEvent'),
  event: DesktopEventSchema,
})

export const DevWebTerminalEventEnvelope = Schema.Struct({
  channel: Schema.Literal('terminalEvent'),
  event: TerminalEvent,
})
