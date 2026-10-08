import type http from 'node:http'
import type { DesktopRequestHandlerMap } from '../../shared/desktop-ipc'
import { sendText } from './http-response'

async function writeFrame(response: http.ServerResponse, frame: string) {
  if (response.destroyed || response.writableEnded)
    throw new Error('Package UI event channel closed.')
  if (response.write(frame)) return
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      response.off('drain', drained)
      response.off('close', closed)
      response.off('error', failed)
    }
    const drained = () => {
      cleanup()
      resolve()
    }
    const closed = () => {
      cleanup()
      reject(new Error('Package UI event channel closed.'))
    }
    const failed = (error: Error) => {
      cleanup()
      reject(error)
    }
    response.once('drain', drained)
    response.once('close', closed)
    response.once('error', failed)
  })
}

/** Each authenticated event channel owns exactly one package binding lifetime. */
export async function streamPackageUiEvents(
  handlers: DesktopRequestHandlerMap,
  clients: Set<http.ServerResponse>,
  owners: Map<string, http.ServerResponse>,
  response: http.ServerResponse,
  sessionId: string,
) {
  if (owners.has(sessionId)) {
    sendText(response, 409, 'Package UI binding already has an event channel.')
    return
  }
  owners.set(sessionId, response)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clients.delete(response)
    owners.delete(sessionId)
    void Promise.resolve(handlers.closePackageUiBinding({ sessionId })).catch((error) =>
      console.error('Package UI channel cleanup failed.', error),
    )
  }
  response.on('close', close)
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  })
  clients.add(response)
  try {
    await writeFrame(response, ': connected\n\n')
    while (!closed) {
      const events = await handlers.readPackageUiBindingEvents({ sessionId })
      if (closed) break
      if (events.length === 0) await writeFrame(response, ': heartbeat\n\n')
      for (const event of events) await writeFrame(response, `data: ${JSON.stringify(event)}\n\n`)
    }
  } catch (error) {
    if (!closed)
      response.write(
        `data: ${JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : String(error) })}\n\n`,
      )
  } finally {
    close()
    response.end()
  }
}
