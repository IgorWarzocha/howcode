import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  service: vi.fn(async () => ({})),
  createServer: vi.fn(),
  write: vi.fn(async () => undefined),
  dispose: vi.fn(async () => undefined),
}))
vi.mock('./runtime.ts', () => ({ getTerminalEffectService: mocks.service }))
vi.mock('./rpc-server.ts', () => ({ createTerminalRpcServer: mocks.createServer }))

import { createTerminalHostPlugin } from './host-plugin.ts'

// biome-ignore lint/style/useNamingConvention: Effect RPC wire discriminator.
const message = { _tag: 'Eof' } as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createServer.mockResolvedValue({ write: mocks.write, dispose: mocks.dispose })
})

describe('terminal host demand lifecycle', () => {
  it('does not initialize unused terminals, including during cleanup', async () => {
    const plugin = createTerminalHostPlugin(() => undefined)
    await plugin.dispose()
    expect(mocks.service).not.toHaveBeenCalled()
    expect(mocks.createServer).not.toHaveBeenCalled()
    await expect(plugin.write(message)).rejects.toThrow('shutting down')
  })

  it('shares concurrent startup and disposes the demanded server', async () => {
    const plugin = createTerminalHostPlugin(() => undefined)
    await Promise.all([plugin.write(message), plugin.write(message)])
    expect(mocks.service).toHaveBeenCalledTimes(1)
    expect(mocks.createServer).toHaveBeenCalledTimes(1)
    expect(mocks.write).toHaveBeenCalledTimes(2)
    await plugin.dispose()
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
  })

  it('drains startup during shutdown without dispatching late demand', async () => {
    let release: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      release = resolve
    })
    mocks.createServer.mockImplementationOnce(async () => {
      await started
      return { write: mocks.write, dispose: mocks.dispose }
    })
    const plugin = createTerminalHostPlugin(() => undefined)
    const pending = expect(plugin.write(message)).rejects.toThrow('shutting down')
    const cleanup = plugin.dispose()
    release()
    await Promise.all([pending, cleanup])
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps startup failure visible to demand and cleanup', async () => {
    mocks.createServer.mockRejectedValueOnce(new Error('startup failed'))
    const plugin = createTerminalHostPlugin(() => undefined)
    await expect(plugin.write(message)).rejects.toThrow('startup failed')
    await expect(plugin.dispose()).rejects.toThrow('startup failed')
    expect(mocks.dispose).not.toHaveBeenCalled()
  })
})
