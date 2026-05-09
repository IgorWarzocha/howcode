import * as Schema from 'effect/Schema'
import * as Rpc from 'effect/unstable/rpc/Rpc'
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup'
import type { DesktopEventChannel, DesktopRequestChannel } from './desktop-ipc'

export const HOWCODE_RPC_WS_PATH = '/api/app/rpc'

export const HowcodeRpcDesktopRequestChannel = Schema.String.pipe(
  Schema.brand('HowcodeRpcDesktopRequestChannel'),
)
export type HowcodeRpcDesktopRequestChannel = DesktopRequestChannel

export const HowcodeRpcDesktopEventChannel = Schema.Literals(['desktopEvent', 'terminalEvent'])
export type HowcodeRpcDesktopEventChannel = DesktopEventChannel

export const HowcodeRpcRequestInput = Schema.Struct({
  channel: HowcodeRpcDesktopRequestChannel,
  params: Schema.Unknown,
})
export type HowcodeRpcRequestInput = typeof HowcodeRpcRequestInput.Type

export const HowcodeRpcEventSubscriptionInput = Schema.Struct({
  channel: HowcodeRpcDesktopEventChannel,
})
export type HowcodeRpcEventSubscriptionInput = typeof HowcodeRpcEventSubscriptionInput.Type

export const HowcodeRpcEventEnvelope = Schema.Struct({
  channel: HowcodeRpcDesktopEventChannel,
  event: Schema.Unknown,
})
export type HowcodeRpcEventEnvelope = typeof HowcodeRpcEventEnvelope.Type

export class HowcodeRpcRequestError extends Schema.TaggedErrorClass<HowcodeRpcRequestError>()(
  'HowcodeRpcRequestError',
  {
    channel: Schema.String,
    message: Schema.String,
  },
) {}

export const HOWCODE_RPC_METHODS = {
  appRequest: 'app.request',
  eventsSubscribe: 'events.subscribe',
} as const

export const HowcodeAppRequestRpc = Rpc.make(HOWCODE_RPC_METHODS.appRequest, {
  payload: HowcodeRpcRequestInput,
  success: Schema.Unknown,
  error: HowcodeRpcRequestError,
})

export const HowcodeEventsSubscribeRpc = Rpc.make(HOWCODE_RPC_METHODS.eventsSubscribe, {
  payload: HowcodeRpcEventSubscriptionInput,
  success: HowcodeRpcEventEnvelope,
  stream: true,
})

export const HowcodeRpcGroup = RpcGroup.make(HowcodeAppRequestRpc, HowcodeEventsSubscribeRpc)
