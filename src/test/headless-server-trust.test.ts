import { describe, expect, it } from 'vitest'
import { createHostTrust } from '../electron/main/headless/auth'

describe('headless server host trust', () => {
  it('rejects unconfigured hosts and ports', () => {
    const loopbackTrust = createHostTrust({ host: '127.0.0.1', port: 5173 })

    expect(loopbackTrust('example.com:5173')).toBe(false)
    expect(loopbackTrust('127.0.0.1:5174')).toBe(false)
    expect(createHostTrust({ host: '0.0.0.0', port: 5173 })('desktop.local:5174')).toBe(false)
  })
})
