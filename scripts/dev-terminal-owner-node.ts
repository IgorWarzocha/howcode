import { once } from 'node:events'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createDevTerminalOwner } from '@howaboua/howcode-terminal/service'
import { withDirectoryActivity } from '../desktop/runtime/directory-activity.ts'
import { getDesktopUserDataPath } from '../desktop/user-data-path.ts'
import { desktopShutdownTimeouts } from '../shared/desktop-shutdown-deadlines.ts'
import { DEV_SERVER_HOST } from '../shared/dev-server.ts'
import { prepareServiceNativeRuntime } from '../src/desktop-host/service-native-runtime.ts'

const { HOWCODE_DEV_WEB_BRIDGE_TOKEN: token, HOWCODE_DEV_TERMINAL_URL: externalOwner } = process.env
if (!token || externalOwner) throw new Error('Invalid dev terminal owner configuration.')
await prepareServiceNativeRuntime({ nodeExecutable: process.execPath })
const owner = await createDevTerminalOwner({
  dataDirectory: getDesktopUserDataPath(),
  withDirectoryActivity,
})
const connections = new Set<http.ServerResponse>()
async function readBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > 2 * 1024 * 1024) throw new Error('Terminal RPC request too large.')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

async function writeBody(result: Response, response: http.ServerResponse, signal: AbortSignal) {
  const reader = result.body?.getReader()
  if (!reader) return
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      if (!response.write(value)) await once(response, 'drain', { signal })
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}
const server = http.createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${token}` || request.method !== 'POST') {
    response.writeHead(403).end()
    return
  }
  connections.add(response)
  const abort = new AbortController()
  response.once('close', () => {
    connections.delete(response)
    abort.abort()
  })
  void (async () => {
    const result = await owner.handle(
      new Request(`http://${DEV_SERVER_HOST}/`, {
        method: 'POST',
        body: await readBody(request),
        signal: abort.signal,
        headers: { 'content-type': request.headers['content-type'] ?? 'application/ndjson' },
      }),
    )
    response.writeHead(result.status, Object.fromEntries(result.headers))
    await writeBody(result, response, abort.signal)
    response.end()
  })().catch((error: unknown) => {
    if (abort.signal.aborted) return
    console.error('Dev terminal HTTP transport failed.', error)
    if (!response.headersSent) response.writeHead(500)
    response.destroy(error instanceof Error ? error : undefined)
  })
})
let stopping = false
async function shutdown() {
  if (stopping) return
  stopping = true
  const deadline = setTimeout(() => process.exit(1), desktopShutdownTimeouts.serverCleanupMs)
  try {
    const closed = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    for (const response of connections) response.destroy()
    server.closeAllConnections()
    await owner.dispose()
    await closed
    clearTimeout(deadline)
    process.exit(0)
  } catch (error) {
    console.error('Dev terminal owner cleanup failed.', error)
    process.exit(1)
  }
}
process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
process.once('disconnect', () => void shutdown())
server.listen(0, DEV_SERVER_HOST)
await once(server, 'listening')
process.send?.({ type: 'ready', port: (server.address() as AddressInfo).port })
