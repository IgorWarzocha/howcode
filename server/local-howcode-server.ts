import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import type { AppTransport } from '../shared/app-transport'
import type { DesktopRequestHandlerMap } from '../shared/desktop-ipc'
import { createHowcodeRpcClientTransport } from './howcode-rpc-client-transport'
import { type HowcodeServerHandle, startHowcodeServer } from './howcode-server'

export type LocalHowcodeServer = {
  handle: HowcodeServerHandle
  transport: AppTransport
  baseUrl: string
  authToken: string
}

export type LocalHowcodeServerConfig = {
  host?: string
  port?: number
  token?: string
  webRoot?: string | null
}

export function createDirectHandlerTransport(
  handlers: DesktopRequestHandlerMap,
  eventTransport: Pick<AppTransport, 'subscribe'>,
): AppTransport {
  return {
    request: async (channel, params) => await handlers[channel](params),
    subscribe: eventTransport.subscribe,
  }
}

export async function startLocalHowcodeServer(input: {
  handlers: DesktopRequestHandlerMap
  eventTransport: Pick<AppTransport, 'subscribe'>
  config?: LocalHowcodeServerConfig
}): Promise<LocalHowcodeServer> {
  const authToken = input.config?.token ?? randomUUID()
  const handle = await Effect.runPromise(
    startHowcodeServer(
      {
        authToken,
        host: input.config?.host ?? '127.0.0.1',
        port: input.config?.port ?? 0,
        webRoot: input.config?.webRoot ?? null,
      },
      createDirectHandlerTransport(input.handlers, input.eventTransport),
    ),
  )
  const baseUrl = `http://${handle.address.host}:${handle.address.port}`
  return {
    authToken,
    baseUrl,
    handle,
    transport: createHowcodeRpcClientTransport({ authToken, baseUrl }),
  }
}

export async function stopLocalHowcodeServer(server: LocalHowcodeServer | null) {
  if (!server) {
    return
  }
  await Effect.runPromise(Effect.catch(server.handle.close, () => Effect.void))
}
