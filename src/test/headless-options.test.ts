import { describe, expect, it } from 'vitest'

import { getHeadlessAccessUrl, parseHeadlessServerOptions } from '../electron/main/headless/options'

describe('headless options', () => {
  it('stays disabled by default', () => {
    expect(parseHeadlessServerOptions([], {})).toEqual({
      accessToken: null,
      authRequired: false,
      enabled: false,
      host: '127.0.0.1',
      port: 5173,
    })
  })

  it('parses cli host and port', () => {
    expect(
      parseHeadlessServerOptions(['--headless', '--host', '0.0.0.0', '--port=3000'], {}),
    ).toMatchObject({
      authRequired: true,
      enabled: true,
      host: '0.0.0.0',
      port: 3000,
    })
  })

  it('uses configured access tokens for remote headless auth', () => {
    expect(
      parseHeadlessServerOptions(['--headless', '--host', '0.0.0.0', '--token', 'secret'], {}),
    ).toMatchObject({
      accessToken: 'secret',
      authRequired: true,
    })
  })

  it('accepts the internal Electron-safe flag', () => {
    expect(parseHeadlessServerOptions(['--howcode-headless'], {})).toMatchObject({
      enabled: true,
    })
  })

  it('uses env fallback', () => {
    expect(
      parseHeadlessServerOptions([], {
        HOWCODE_HEADLESS: '1',
        HOWCODE_HEADLESS_HOST: '192.168.1.20',
        HOWCODE_HEADLESS_PORT: '3001',
        HOWCODE_HEADLESS_TOKEN: 'env-secret',
      }),
    ).toEqual({
      accessToken: 'env-secret',
      authRequired: true,
      enabled: true,
      host: '192.168.1.20',
      port: 3001,
    })
  })

  it('prints loopback as the access host for wildcard binds', () => {
    expect(getHeadlessAccessUrl({ host: '0.0.0.0', port: 5173 })).toBe('http://127.0.0.1:5173')
  })

  it('prints access tokens in the URL fragment only when auth is required', () => {
    expect(
      getHeadlessAccessUrl({
        host: '0.0.0.0',
        port: 5173,
        authRequired: true,
        accessToken: 'secret token',
      }),
    ).toBe('http://127.0.0.1:5173#token=secret%20token')
  })
})
