import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpcDispose: vi.fn(async () => undefined),
  closeAll: vi.fn(async () => undefined),
  runtimeDispose: vi.fn(async () => undefined),
}))
vi.mock('./host-component.ts', () => ({
  createTerminalHostComponent: () => ({ write: vi.fn(), dispose: mocks.rpcDispose }),
}))
vi.mock('./runtime.ts', () => ({
  closeAllTerminals: mocks.closeAll,
  disposeTerminalRuntime: mocks.runtimeDispose,
}))

import { createTerminalServiceComponent } from './component.ts'

beforeEach(() => vi.clearAllMocks())

describe('terminal component cleanup', () => {
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
    const component = createTerminalServiceComponent(() => undefined)
    const disposal = component.dispose()
    expect(component.dispose()).toBe(disposal)
    await expect(disposal).rejects.toThrow('Failed to dispose terminal component')
    expect(order).toEqual(['rpc', 'sessions', 'runtime'])
  })
})
