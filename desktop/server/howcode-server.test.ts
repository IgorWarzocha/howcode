import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import type { AppTransport } from '../../shared/app-transport'
import type { DesktopEvent } from '../../shared/desktop-contracts'
import {
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  howcodeServerDescriptor,
} from '../../shared/howcode-server-contracts'
import { startHowcodeServer } from './howcode-server'
import { createHowcodeServerTransport } from './howcode-server-transport'

const closeEffects: Effect.Effect<void, unknown>[] = []

afterEach(async () => {
  while (closeEffects.length > 0) {
    const close = closeEffects.pop()
    if (close) {
      await Effect.runPromise(Effect.catch(close, () => Effect.void))
    }
  }
})

async function startTestServer(transport: AppTransport) {
  const handle = await Effect.runPromise(
    startHowcodeServer(
      {
        host: '127.0.0.1',
        port: 0,
        authToken: 'test-token',
      },
      transport,
    ),
  )
  closeEffects.push(handle.close)
  return {
    handle,
    baseUrl: `http://${handle.address.host}:${handle.address.port}`,
  }
}

describe('Howcode server', () => {
  it('reports health and descriptor metadata', async () => {
    const { baseUrl } = await startTestServer({
      request: vi.fn(),
      subscribe: vi.fn(),
    })

    await expect(
      fetch(new URL('/healthz', baseUrl)).then((response) => response.json()),
    ).resolves.toEqual({
      ok: true,
    })
    await expect(
      fetch(new URL(HOWCODE_SERVER_DESCRIPTOR_PATH, baseUrl)).then((response) => response.json()),
    ).resolves.toEqual(howcodeServerDescriptor)
  })

  it('rejects unauthenticated app transport requests', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const { baseUrl } = await startTestServer({
      request,
      subscribe: vi.fn(),
    })

    const response = await fetch(new URL('/api/app/request/terminalWrite', baseUrl), {
      body: JSON.stringify({ sessionId: 'terminal-1', data: 'hello' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(401)
    expect(request).not.toHaveBeenCalled()
  })

  it('streams app transport events over WebSocket', async () => {
    const listeners = new Set<(event: DesktopEvent) => void>()
    const { baseUrl } = await startTestServer({
      request: vi.fn(),
      subscribe: vi.fn((_channel, listener) => {
        listeners.add(listener as (event: DesktopEvent) => void)
        return () => listeners.delete(listener as (event: DesktopEvent) => void)
      }),
    })

    const response = new Promise<unknown>((resolve, reject) => {
      const webSocket = new WebSocket(new URL('/api/app/ws?token=test-token', baseUrl))
      webSocket.on('open', () => {
        webSocket.send(JSON.stringify({ type: 'subscribe', channel: 'desktopEvent' }))
      })
      webSocket.on('message', (data) => {
        webSocket.close()
        resolve(JSON.parse(data.toString()))
      })
      webSocket.on('error', reject)
      const emitWhenSubscribed = () => {
        if (listeners.size === 0) {
          setTimeout(emitWhenSubscribed, 5)
          return
        }
        for (const listener of listeners) {
          listener({ type: 'shell-state-refresh' })
        }
      }
      emitWhenSubscribed()
    })

    await expect(response).resolves.toMatchObject({
      type: 'event',
      channel: 'desktopEvent',
      event: { type: 'shell-state-refresh' },
    })
  })

  it('dispatches typed app transport requests over HTTP', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const { baseUrl } = await startTestServer({
      request,
      subscribe: vi.fn(),
    })
    const client = createHowcodeServerTransport({ authToken: 'test-token', baseUrl })

    await expect(
      client.request('terminalWrite', { sessionId: 'terminal-1', data: 'hello' }),
    ).resolves.toEqual({
      ok: true,
    })
    expect(request).toHaveBeenCalledWith('terminalWrite', {
      sessionId: 'terminal-1',
      data: 'hello',
    })
  })
})
