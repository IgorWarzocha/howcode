import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import type { AppTransport } from '../shared/app-transport'
import { HOWCODE_RPC_WS_PATH } from '../shared/howcode-rpc'
import {
  HOWCODE_SERVER_DESCRIPTOR_PATH,
  howcodeServerDescriptor,
} from '../shared/howcode-server-contracts'
import { startHowcodeServer } from './howcode-server'

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
    ).resolves.toEqual({ ...howcodeServerDescriptor, runtimeKind: 'desktop-local' })
  })

  it('requires auth token when binding outside loopback', async () => {
    await expect(
      Effect.runPromise(
        startHowcodeServer(
          {
            authToken: '',
            host: '0.0.0.0',
            port: 0,
          },
          {
            request: vi.fn(),
            subscribe: vi.fn(),
          },
        ),
      ),
    ).rejects.toThrow('auth token is required')
  })

  it('rejects unauthenticated Effect RPC WebSocket upgrades', async () => {
    const { baseUrl } = await startTestServer({
      request: vi.fn(),
      subscribe: vi.fn(),
    })

    const failure = new Promise<Error>((resolve) => {
      const webSocket = new WebSocket(new URL(HOWCODE_RPC_WS_PATH, baseUrl))
      webSocket.on('error', resolve)
    })

    await expect(failure).resolves.toMatchObject({
      message: 'Unexpected server response: 401',
    })
  })

  it('accepts programmatic prompts over the remote API', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const { baseUrl } = await startTestServer({
      request,
      subscribe: vi.fn(),
    })

    const response = await fetch(new URL('/api/programmatic/prompt', baseUrl), {
      body: JSON.stringify({ projectId: '/remote/project', text: 'hello remote' }),
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      method: 'POST',
    })

    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledWith('invokeAction', {
      action: 'composer.send',
      payload: {
        chatGroupId: null,
        projectId: '/remote/project',
        sessionPath: null,
        text: 'hello remote',
      },
    })
  })
})
