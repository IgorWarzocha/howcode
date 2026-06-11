import { describe, expect, it } from 'vitest'

import {
  DEV_SERVER_HOST,
  DEV_SERVER_HOST_ENV,
  DEV_SERVER_PUBLIC_HOST_ENV,
  isDevServerLoopbackHost,
  isDevServerWildcardHost,
  parseDevServerMetadata,
  resolveDevServerListenHost,
  resolveDevServerPublicHost,
} from '../../shared/dev-server'

describe('dev server helpers', () => {
  it('uses localhost by default', () => {
    expect(resolveDevServerListenHost({})).toBe(DEV_SERVER_HOST)
  })

  it('accepts an explicit listen host', () => {
    expect(resolveDevServerListenHost({ [DEV_SERVER_HOST_ENV]: '0.0.0.0' })).toBe('0.0.0.0')
  })

  it('falls back to loopback access for wildcard binds', () => {
    expect(resolveDevServerPublicHost('0.0.0.0', {})).toBe(DEV_SERVER_HOST)
  })

  it('allows an explicit public access host', () => {
    expect(
      resolveDevServerPublicHost('0.0.0.0', { [DEV_SERVER_PUBLIC_HOST_ENV]: 'howcode.local' }),
    ).toBe('howcode.local')
  })

  it('classifies loopback and wildcard hosts', () => {
    expect(isDevServerLoopbackHost('localhost')).toBe(true)
    expect(isDevServerLoopbackHost('192.168.1.10')).toBe(false)
    expect(isDevServerWildcardHost('0.0.0.0')).toBe(true)
  })

  it('prefers metadata url over host and port', () => {
    expect(
      parseDevServerMetadata(
        JSON.stringify({ host: '0.0.0.0', port: 5173, url: 'http://127.0.0.1:5173' }),
      ),
    ).toBe('http://127.0.0.1:5173')
  })
})
