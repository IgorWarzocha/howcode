import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import type { DesktopServiceRuntime } from '../../../../shared/desktop-service-contracts'
import { scheduleBrowserUploadComposerAttachmentsCleanup } from '../../../desktop-host/browser-upload-attachments'
import { createDesktopRequestHandlers } from '../ipc/desktop-request-handlers'
import { getRendererDistDirectory } from '../runtime/app-paths'
import type { AppUpdater } from '../updater/app-updater'
import { createHeadlessAuthState, createHostTrust } from './auth'
import type { HeadlessServerOptions } from './options'
import {
  type HeadlessRequestContext,
  handleHeadlessHttpRequest,
  sendHeadlessSseEvent,
} from './request-router'

type HeadlessServerInput = {
  runtime: DesktopServiceRuntime
  appUpdater: AppUpdater
  options: Pick<HeadlessServerOptions, 'accessToken' | 'authRequired' | 'host' | 'port'>
  onSettingsChanged?: (() => Promise<void> | void) | undefined
}

export interface HeadlessServer {
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
  const rendererDistDirectory = getRendererDistDirectory()
  const requestContext: HeadlessRequestContext = {
    allSseClients: new Set(),
    auth: createHeadlessAuthState(input.options),
    desktopEventClients: new Set(),
    handlers: createDesktopRequestHandlers(
      input.runtime,
      input.appUpdater,
      input.onSettingsChanged,
    ),
    indexHtml: await readFile(path.join(rendererDistDirectory, 'index.html'), 'utf8'),
    isTrustedHost: createHostTrust(input.options),
    rendererDistDirectory,
    terminalEventClients: new Set(),
  }

  const unsubscribeDesktopEvents = input.runtime.piThreads.subscribeDesktopEvents((event) => {
    sendHeadlessSseEvent(requestContext.desktopEventClients, 'desktopEvent', event)
  })
  const unsubscribeTerminalEvents = input.runtime.terminalManager.subscribeTerminalEvents(
    (event) => {
      sendHeadlessSseEvent(requestContext.terminalEventClients, 'terminalEvent', event)
    },
  )
  const unsubscribeAppUpdateEvents = input.appUpdater.subscribe((state) => {
    sendHeadlessSseEvent(requestContext.desktopEventClients, 'desktopEvent', {
      type: 'app-update',
      state,
    })
  })

  const server = http.createServer((request, response) =>
    handleHeadlessHttpRequest(requestContext, request, response),
  )
  let finalized = false
  const finalize = () => {
    if (finalized) return
    finalized = true
    unsubscribeDesktopEvents()
    unsubscribeTerminalEvents()
    unsubscribeAppUpdateEvents()
    closeHeadlessClients(requestContext)
  }
  await listenHeadlessServer(server, input.options, finalize)
  scheduleBrowserUploadComposerAttachmentsCleanup({
    onError: (error) => console.warn('headless browser upload cleanup failed', { error }),
  })

  return {
    close: async () => {
      finalize()
      if (!server.listening) return
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  } satisfies HeadlessServer
}
