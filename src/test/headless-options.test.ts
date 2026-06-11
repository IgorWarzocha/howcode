import { describe, expect, it } from 'vitest'

import { getHeadlessAccessUrl, parseHeadlessServerOptions } from '../electron/main/headless/options'

describe('headless options', () => {
  it('stays disabled by default', () => {
    expect(parseHeadlessServerOptions([], {})).toEqual({
      enabled: false,
      host: '127.0.0.1',
      port: 5173,
    })
  })

  it('parses cli host and port', () => {
    expect(
      parseHeadlessServerOptions(['--headless', '--host', '0.0.0.0', '--port=3000'], {}),
    ).toEqual({
      enabled: true,
      host: '0.0.0.0',
      port: 3000,
    })
  })

  it('uses env fallback', () => {
    expect(
      parseHeadlessServerOptions([], {
        HOWCODE_HEADLESS: '1',
        HOWCODE_HEADLESS_HOST: '192.168.1.20',
        HOWCODE_HEADLESS_PORT: '3001',
      }),
    ).toEqual({
      enabled: true,
      host: '192.168.1.20',
      port: 3001,
    })
  })

  it('prints loopback as the access host for wildcard binds', () => {
    expect(getHeadlessAccessUrl({ host: '0.0.0.0', port: 5173 })).toBe('http://127.0.0.1:5173')
  })
})
