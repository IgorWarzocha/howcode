import type http from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { appControlTool } from '../../shared/app-control'
import type { DesktopServiceRuntime } from '../../shared/desktop-service-contracts'
import { readJsonBody, sendJson } from './http-response'
import { authoriseMcpRequest } from './mcp-auth'

const maxBodyBytes = 64 * 1024
const maxRequests = 8

function sendRequestFailure(response: http.ServerResponse, error: unknown) {
  if (!(response.destroyed || response.headersSent)) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'MCP request failed.',
    })
  } else if (!response.destroyed) response.destroy()
}

export function createMcpEndpoint(input: {
  app: DesktopServiceRuntime['app']
  accessToken: string | null
  isTrustedHost: (host: string | undefined) => boolean
}) {
  const active = new Set<Promise<void>>()
  const servers = new Map<Server, http.ServerResponse>()
  let closing = false

  async function serve(request: http.IncomingMessage, response: http.ServerResponse) {
    const server = new Server(
      { name: 'howcode', version: '1.0.0' },
      { capabilities: { tools: {} } },
    )
    const transport = new StreamableHTTPServerTransport({
      // Omitting the generator selects the SDK's stateless mode.
      enableJsonResponse: true,
    })
    // A disconnected caller must not free its admission slot while a mutation is still running.
    const calls = new Set<Promise<unknown>>()
    server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [appControlTool] }))
    server.setRequestHandler(CallToolRequestSchema, async (toolRequest, extra) => {
      if (closing || extra.signal.aborted) throw new Error('MCP request closed.')
      if (toolRequest.params.name !== appControlTool.name) throw new Error('Unknown tool.')
      const call = input.app.appControlMcp(toolRequest.params.arguments ?? {})
      calls.add(call)
      try {
        const result = await call
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } finally {
        calls.delete(call)
      }
    })
    servers.set(server, response)
    let disconnected: () => void = () => undefined
    const closed = new Promise<void>((resolve) => {
      disconnected = resolve
    })
    const onClose = () => {
      disconnected()
    }
    response.once('close', onClose)
    const bodyTimer = setTimeout(() => request.destroy(), 10_000)
    try {
      const body = await readJsonBody(request, maxBodyBytes)
      clearTimeout(bodyTimer)
      if (Array.isArray(body)) {
        sendJson(response, 400, { error: 'MCP batch requests are not supported.' })
        return
      }
      if (closing || response.destroyed) return
      // The SDK's transport accessor types violate its Transport interface under exactOptionalPropertyTypes.
      // @ts-expect-error Official SDK transport, without altering its runtime or weakening project types.
      await server.connect(transport)
      await Promise.race([transport.handleRequest(request, response, body), closed])
    } catch (error) {
      sendRequestFailure(response, error)
    } finally {
      clearTimeout(bodyTimer)
      await Promise.allSettled(calls)
      response.off('close', onClose)
      await server.close()
      servers.delete(server)
    }
  }

  return {
    handle(request: http.IncomingMessage, response: http.ServerResponse) {
      if (!authoriseMcpRequest(request, response, input.accessToken, input.isTrustedHost)) return
      if (request.method !== 'POST') {
        response.setHeader('allow', 'POST')
        sendJson(response, 405, { error: 'MCP supports POST only; no event stream or sessions.' })
        return
      }
      if (closing || active.size >= maxRequests) {
        response.setHeader('retry-after', '1')
        sendJson(response, 503, { error: 'MCP is busy or shutting down.' })
        return
      }
      const length = Number(request.headers['content-length'])
      if (length > maxBodyBytes) {
        sendJson(response, 413, { error: 'MCP body exceeds 64 KiB.' })
        return
      }
      const pending = serve(request, response)
      active.add(pending)
      void pending
        .finally(() => active.delete(pending))
        .catch((error) => {
          console.error('MCP request cleanup failed', { error })
        })
    },
    async close() {
      closing = true
      for (const response of servers.values()) response.destroy()
      await Promise.allSettled(active)
    },
  }
}
