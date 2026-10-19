import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import type { DesktopServiceRuntime } from '../../shared/desktop-service-contracts'
import { desktopShutdownTimeouts } from '../../shared/desktop-shutdown-deadlines'
import { scheduleBrowserUploadComposerAttachmentsCleanup } from '../desktop-host/browser-upload-attachments'
import { createDesktopRequestHandlers } from '../desktop-host/desktop-requests/handlers'
import { createSystemRequestHandlers } from '../desktop-host/desktop-requests/system'
import { createHeadlessAuthState, createHostTrust } from './auth'
import { createMcpEndpoint } from './mcp'
import { createMcpHostTrust } from './mcp-auth'
import type { HeadlessServerOptions } from './options'
import {
  type HeadlessRequestContext,
  handleHeadlessHttpRequest,
  sendHeadlessSseEvent,
} from './request-router'

type HeadlessServerInput = {
  runtime: DesktopServiceRuntime
  rendererDistDirectory?: string
  proxyToken?: string
  options: Pick<HeadlessServerOptions, 'accessToken' | 'authRequired' | 'host' | 'port'>
  onSettingsChanged?: (() => Promise<void> | void) | undefined
}

export interface HeadlessServer {
  readonly port: number
  readonly close: () => Promise<void>
}

function closeHeadlessClients(context: HeadlessRequestContext) {
  for (const client of context.allSseClients) {
    client.end()
    client.destroy()
  }
  context.allSseClients.clear()
  context.desktopEventClients.clear()
  context.terminalEventClients.clear()
}

export async function listenHeadlessServer(
  server: http.Server,
  options: Pick<HeadlessServerOptions, 'port' | 'host'>,
  finalize: () => void,
) {
  server.once('close', finalize)
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(options.port, options.host, () => {
        server.off('error', reject)
        resolve()
      })
    })
  } catch (error) {
    server.off('close', finalize)
    finalize()
    throw error
  }
}

export async function startHeadlessServer(input: HeadlessServerInput) {
  const rendererDistDirectory = input.rendererDistDirectory ?? ''
  const requestContext: HeadlessRequestContext = {
    allSseClients: new Set(),
    auth: createHeadlessAuthState(input.options),
    desktopEventClients: new Set(),
    handlers: createDesktopRequestHandlers({
      runtime: input.runtime,
      platform: createSystemRequestHandlers(),
      onSettingsChanged: input.onSettingsChanged,
    }),
    indexHtml: rendererDistDirectory
      ? await readFile(path.join(rendererDistDirectory, 'index.html'), 'utf8')
      : '',
    isTrustedHost: input.proxyToken ? () => true : createHostTrust(input.options),
    bridgeToken: input.proxyToken,
    rendererDistDirectory,
    terminalEventClients: new Set(),
    packageUiEventClients: new Map(),
    mcp: createMcpEndpoint({
      app: input.runtime.app,
      accessToken: input.options.accessToken,
      isTrustedHost: createMcpHostTrust(input.options.host, () => {
        const address = server.address()
        return address && typeof address !== 'string' ? address.port : input.options.port
      }),
    }),
  }

  const unsubscribeDesktopEvents = input.runtime.app.subscribeDesktopEvents((event) => {
    sendHeadlessSseEvent(requestContext.desktopEventClients, 'desktopEvent', event)
  })
  const unsubscribeTerminalEvents = input.runtime.terminalManager.subscribeTerminalEvents(
    (event) => {
      sendHeadlessSseEvent(requestContext.terminalEventClients, 'terminalEvent', event)
    },
  )
  const server = http.createServer((request, response) => {
    if (
      input.proxyToken &&
      request.headers['x-howcode-dev-web-bridge-token'] !== input.proxyToken
    ) {
      response.writeHead(403).end('Forbidden')
      return
    }
    handleHeadlessHttpRequest(requestContext, request, response)
  })
  let finalized = false
  const finalize = () => {
    if (finalized) return
    finalized = true
    unsubscribeDesktopEvents()
    unsubscribeTerminalEvents()
    closeHeadlessClients(requestContext)
  }
  await listenHeadlessServer(server, input.options, finalize)
  scheduleBrowserUploadComposerAttachmentsCleanup({
    onError: (error) => console.warn('headless browser upload cleanup failed', { error }),
  })
  let closing: Promise<void> | null = null
  return {
    port: (server.address() as import('node:net').AddressInfo).port,
    close: () => {
      if (closing) return closing
      finalize()
      const closed = server.listening
        ? new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => server.closeAllConnections(),
              desktopShutdownTimeouts.serverCleanupMs -
                desktopShutdownTimeouts.desktopServiceTerminationMs,
            )
            server.close((error) => {
              clearTimeout(timer)
              if (error) reject(error)
              else resolve()
            })
          })
        : Promise.resolve()
      closing = Promise.all([closed, requestContext.mcp.close()]).then(() => undefined)
      return closing
    },
  } satisfies HeadlessServer
}
