import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppTransport } from '../../shared/app-transport'
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

  it('dispatches typed app transport requests over HTTP', async () => {
    const request = vi.fn(async () => ({ ok: true }))
    const { baseUrl } = await startTestServer({
      request,
      subscribe: vi.fn(),
    })
    const client = createHowcodeServerTransport({ baseUrl })

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
