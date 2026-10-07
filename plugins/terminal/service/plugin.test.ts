import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpcDispose: vi.fn(async () => undefined),
  closeAll: vi.fn(async () => undefined),
  runtimeDispose: vi.fn(async () => undefined),
}))
vi.mock('./host-plugin.ts', () => ({
  createTerminalHostPlugin: () => ({ write: vi.fn(), dispose: mocks.rpcDispose }),
}))
vi.mock('./runtime.ts', () => ({
  closeAllTerminals: mocks.closeAll,
  disposeTerminalRuntime: mocks.runtimeDispose,
}))

import { createTerminalServicePlugin } from './plugin.ts'

beforeEach(() => vi.clearAllMocks())

describe('terminal plugin cleanup', () => {
  it('drains RPC before sessions and finalizes runtime despite session cleanup failure', async () => {
    const order: string[] = []
    mocks.rpcDispose.mockImplementationOnce(async () => {
      order.push('rpc')
    })
    mocks.closeAll.mockImplementationOnce(async () => {
      order.push('sessions')
      throw new Error('session cleanup failed')
    })
    mocks.runtimeDispose.mockImplementationOnce(async () => {
      order.push('runtime')
    })
    const plugin = createTerminalServicePlugin(() => undefined)
    const disposal = plugin.dispose()
    expect(plugin.dispose()).toBe(disposal)
    await expect(disposal).rejects.toThrow('Failed to dispose terminal plugin')
    expect(order).toEqual(['rpc', 'sessions', 'runtime'])
  })
})
