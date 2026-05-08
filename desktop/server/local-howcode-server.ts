import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import type { AppTransport } from '../../shared/app-transport'
import type { DesktopRequestHandlerMap } from '../../shared/desktop-ipc'
import { type HowcodeServerHandle, startHowcodeServer } from './howcode-server'
import { createHowcodeServerTransport } from './howcode-server-transport'

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
      },
      createDirectHandlerTransport(input.handlers, input.eventTransport),
    ),
  )
  const baseUrl = `http://${handle.address.host}:${handle.address.port}`
  return {
    authToken,
    baseUrl,
    handle,
    transport: createHowcodeServerTransport({ authToken, baseUrl }),
  }
}

export async function stopLocalHowcodeServer(server: LocalHowcodeServer | null) {
  if (!server) {
    return
  }
  await Effect.runPromise(Effect.catch(server.handle.close, () => Effect.void))
}
