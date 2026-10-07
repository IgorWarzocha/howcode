import { expect, it } from 'vitest'
import { createHostTrust } from './auth'

it('accepts bracketed IPv6 loopback authorities without trusting another host or port', () => {
  const trust = createHostTrust({ host: '::1', port: 5173 })
  expect(trust('[::1]:5173')).toBe(true)
  expect(trust('[::1]:5174')).toBe(false)
  expect(trust('[::2]:5173')).toBe(false)
  expect(trust('attacker.example:5173')).toBe(false)
})
