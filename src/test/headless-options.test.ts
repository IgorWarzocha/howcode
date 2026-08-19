import { describe, expect, it } from 'vitest'

import { getHeadlessAccessUrl, parseHeadlessServerOptions } from '../electron/main/headless/options'

describe('headless options', () => {
  it('uses configured access tokens for remote headless auth', () => {
    expect(
      parseHeadlessServerOptions(['--headless', '--host', '0.0.0.0', '--token', 'secret'], {}),
    ).toMatchObject({
      accessToken: 'secret',
      authRequired: true,
    })
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
