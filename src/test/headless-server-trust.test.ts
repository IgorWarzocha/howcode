import { describe, expect, it } from 'vitest'
import { createHostTrust } from '../electron/main/headless/auth'

describe('headless server host trust', () => {
  it('limits loopback servers to their configured local hosts and port', () => {
    const isTrusted = createHostTrust({ host: '127.0.0.1', port: 5173 })

    expect(isTrusted('127.0.0.1:5173')).toBe(true)
    expect(isTrusted('localhost:5173')).toBe(true)
    expect(isTrusted('example.com:5173')).toBe(false)
    expect(isTrusted('127.0.0.1:5174')).toBe(false)
  })

  it('accepts the configured port for wildcard hosts without accepting another port', () => {
    const isTrusted = createHostTrust({ host: '0.0.0.0', port: 5173 })

    expect(isTrusted('desktop.local:5173')).toBe(true)
    expect(isTrusted('desktop.local:5174')).toBe(false)
  })
})
