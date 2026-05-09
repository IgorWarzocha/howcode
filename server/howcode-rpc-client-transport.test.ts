import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppTransport } from '../shared/app-transport'
import { HOWCODE_RPC_WS_PATH } from '../shared/howcode-rpc'
import {
  createHowcodeRpcClientTransport,
  howcodeRpcClientTransportInternals,
} from './howcode-rpc-client-transport'
import { startHowcodeServer } from './howcode-server'

const closeEffects: Effect.Effect<void, unknown>[] = []

afterEach(async () => {
  while (closeEffects.length > 0) {
    const close = closeEffects.pop()
    if (close) await Effect.runPromise(Effect.catch(close, () => Effect.void))
  }
})

async function startTestServer(transport: AppTransport) {
  const handle = await Effect.runPromise(
    startHowcodeServer(
      {
        authToken: 'test-token',
        host: '127.0.0.1',
        port: 0,
      },
      transport,
    ),
  )
  closeEffects.push(handle.close)
  return `http://${handle.address.host}:${handle.address.port}`
}

describe('Howcode RPC client transport', () => {
  it('dispatches requests over the RPC websocket', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const baseUrl = await startTestServer({ request, subscribe: vi.fn() })
    const transport = createHowcodeRpcClientTransport({ authToken: 'test-token', baseUrl })

    await expect(
      transport.request('terminalWrite', { data: 'hello', sessionId: 'terminal-1' }),
    ).resolves.toEqual({ ok: true })
    expect(transport.getStatus()).toMatchObject({
      attemptCount: 1,
      fallbackRequestCount: 0,
      lastTransport: 'rpc',
      phase: 'connected',
    })
    expect(request).toHaveBeenCalledWith('terminalWrite', {
      data: 'hello',
      sessionId: 'terminal-1',
    })
  })

  it('updates status on manual reconnect', async () => {
    const request = vi.fn(async () => ({
      instanceId: 'test',
      instanceName: 'Test',
      projects: [],
      serverUrl: null,
    }))
    const baseUrl = await startTestServer({ request, subscribe: vi.fn() })
    const transport = createHowcodeRpcClientTransport({ authToken: 'test-token', baseUrl })

    await expect(transport.reconnect()).resolves.toBeUndefined()
    expect(transport.getStatus()).toMatchObject({
      hasConnected: true,
      lastTransport: 'rpc',
      phase: 'connected',
      reconnectPhase: 'idle',
    })
    expect(request).toHaveBeenCalledWith('getHowcodeInstanceManifest', {})
  })

  it('builds an authenticated websocket URL', () => {
    const url = new URL(
      howcodeRpcClientTransportInternals.resolveRpcWebSocketUrl('http://127.0.0.1:39317', 'secret'),
    )
    expect(url.protocol).toBe('ws:')
    expect(url.pathname).toBe(HOWCODE_RPC_WS_PATH)
    expect(url.searchParams.get('token')).toBe('secret')
  })
})
