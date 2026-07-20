import * as Schema from 'effect/Schema'
import * as Rpc from 'effect/unstable/rpc/Rpc'
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup'
import type * as RpcMessage from 'effect/unstable/rpc/RpcMessage'
import {
  TerminalCloseRequest,
  TerminalError,
  TerminalEvent,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionFileStat,
  TerminalSessionFileStatRequest,
  TerminalSessionSnapshot,
  TerminalStatusRequest,
  TerminalStatusSnapshot,
  TerminalWriteRequest,
} from './terminal-contracts'

const TerminalListRpc = Rpc.make('terminal.list', {
  payload: Schema.Struct({}),
  success: Schema.mutable(Schema.Array(TerminalSessionSnapshot)),
  error: TerminalError,
})

const TerminalOpenRpc = Rpc.make('terminal.open', {
  payload: TerminalOpenRequest,
  success: TerminalSessionSnapshot,
  error: TerminalError,
})

const TerminalWriteRpc = Rpc.make('terminal.write', {
  payload: TerminalWriteRequest,
  error: TerminalError,
})

const TerminalResizeRpc = Rpc.make('terminal.resize', {
  payload: TerminalResizeRequest,
  error: TerminalError,
})

const TerminalCloseRpc = Rpc.make('terminal.close', {
  payload: TerminalCloseRequest,
  error: TerminalError,
})

const TerminalStatSessionFileRpc = Rpc.make('terminal.statSessionFile', {
  payload: TerminalSessionFileStatRequest,
  success: Schema.NullOr(TerminalSessionFileStat),
  error: TerminalError,
})

const TerminalStatusRpc = Rpc.make('terminal.status', {
  payload: TerminalStatusRequest,
  success: TerminalStatusSnapshot,
  error: TerminalError,
})

export const TerminalEventStreamMessage = Schema.TaggedUnion({
  Ready: {},
  Event: { event: TerminalEvent },
})
export type TerminalEventStreamMessage = typeof TerminalEventStreamMessage.Type

const TerminalEventsRpc = Rpc.make('terminal.events', {
  payload: Schema.Struct({}),
  success: TerminalEventStreamMessage,
  error: TerminalError,
  stream: true,
})

export const TerminalRpcGroup = RpcGroup.make(
  TerminalListRpc,
  TerminalOpenRpc,
  TerminalWriteRpc,
  TerminalResizeRpc,
  TerminalCloseRpc,
  TerminalStatSessionFileRpc,
  TerminalStatusRpc,
  TerminalEventsRpc,
)

export type TerminalRpc = RpcGroup.Rpcs<typeof TerminalRpcGroup>
export type TerminalRpcRequest = RpcMessage.FromClientEncoded
export type TerminalRpcResponse = RpcMessage.FromServerEncoded
