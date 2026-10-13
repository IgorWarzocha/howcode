import { TerminalEvent } from '@howaboua/howcode-terminal/contracts'
import * as Schema from 'effect/Schema'
import { DesktopEventSchema } from '../../shared/desktop-event-schema'

export const DevWebDesktopEventEnvelope = Schema.Struct({
  channel: Schema.Literal('desktopEvent'),
  event: DesktopEventSchema,
})

export const DevWebTerminalEventEnvelope = Schema.Struct({
  channel: Schema.Literal('terminalEvent'),
  event: TerminalEvent,
})
