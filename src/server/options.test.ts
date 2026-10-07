import { expect, it } from 'vitest'
import { parseHeadlessServerOptions } from './options'

it('rejects missing or invalid explicit listener ports instead of binding a default', () => {
  for (const port of ['', '0', '-1', '65536', '1.5', 'oops']) {
    expect(() => parseHeadlessServerOptions([`--port=${port}`], {})).toThrow('Invalid server port')
  }
  expect(() => parseHeadlessServerOptions(['--port'], {})).toThrow('Missing value')
})

it('requires authentication for an explicit token even on loopback', () => {
  expect(parseHeadlessServerOptions(['--token', 'secret'], {})).toMatchObject({
    authRequired: true,
    accessToken: 'secret',
  })
})

it('gives the data-path flag precedence over the environment', () => {
  expect(
    parseHeadlessServerOptions(['--data-path', '/flag'], { HOWCODE_USER_DATA_PATH: '/env' })
      .dataPath,
  ).toBe('/flag')
  expect(parseHeadlessServerOptions([], { HOWCODE_USER_DATA_PATH: '/env' }).dataPath).toBe('/env')
  expect(parseHeadlessServerOptions([], {}).dataPath).toBeNull()
})
