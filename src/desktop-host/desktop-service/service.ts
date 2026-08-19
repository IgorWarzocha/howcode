import type { ChildProcess } from 'node:child_process'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { TerminalRpcServiceClient } from '../terminal-rpc-client'
import { makeDesktopServiceCore } from './core'
import { makeLiveProcessAdapter } from './live-process'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceCore,
  serviceError,
  type TerminalRpcBridge,
} from './types'

export class Service extends Context.Service<Service, DesktopServiceCore<ChildProcess>>()(
  '@howcode/DesktopServiceClient',
) {}

function makeTerminalBridge(
  terminalRpc: TerminalRpcServiceClient,
): TerminalRpcBridge<ChildProcess> {
  return {
    connect: (child) =>
      Effect.tryPromise({
        try: () => terminalRpc.connect(child),
        catch: (error) => serviceError('connectTerminalRpc', error),
      }),
    dispose: (child) =>
      Effect.tryPromise({
        try: () => terminalRpc.dispose(child),
        catch: () => undefined,
      }).pipe(Effect.ignore),
    write: (message) => terminalRpc.write(message),
  }
}

export function makeLayer(
  options: DesktopServiceClientOptions,
  terminalRpc: TerminalRpcServiceClient,
) {
  return Layer.effect(
    Service,
    makeDesktopServiceCore({
      adapter: makeLiveProcessAdapter(options),
      client: options,
      terminal: makeTerminalBridge(terminalRpc),
    }),
  )
}
