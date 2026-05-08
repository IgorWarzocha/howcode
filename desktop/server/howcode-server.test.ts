import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('streams app transport events over SSE', async () => {
    const listeners = new Set<(event: DesktopEvent) => void>()
    const { baseUrl } = await startTestServer({
      request: vi.fn(),
      subscribe: vi.fn((_channel, listener) => {
        listeners.add(listener as (event: DesktopEvent) => void)
        return () => listeners.delete(listener as (event: DesktopEvent) => void)
      }),
    })

    const response = await fetch(new URL('/api/app/events/desktopEvent?token=test-token', baseUrl))
    expect(response.status).toBe(200)
    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    for (const listener of listeners) {
      listener({ type: 'shell-state-refresh' })
    }

    const decoder = new TextDecoder()
    let body = ''
    while (!body.includes('shell-state-refresh')) {
      const read = await reader!.read()
      if (read.done) {
        break
      }
      body += decoder.decode(read.value)
    }
    await reader!.cancel()

    expect(body).toContain('event: desktopEvent')
    expect(body).toContain('shell-state-refresh')
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
