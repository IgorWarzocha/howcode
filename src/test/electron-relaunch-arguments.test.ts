import { describe, expect, it } from 'vitest'
import {
  getRelaunchArguments,
  shouldTakeoverAtStartup,
} from '../electron/main/runtime/relaunch-arguments'

describe('Electron update relaunch', () => {
  it('preserves packaged launch options and drops the development app entrypoint', () => {
    const options = ['--howcode-headless', '--host', '0.0.0.0', '--port=4173']
    expect(getRelaunchArguments(['/opt/howcode', ...options], true)).toEqual(options)
    expect(getRelaunchArguments(['/opt/electron', '/repo', ...options], false)).toEqual(options)
  })

  it('does not detach a staged takeover from a foreground headless invocation', () => {
    expect(shouldTakeoverAtStartup(true)).toBe(false)
    expect(shouldTakeoverAtStartup(false)).toBe(true)
  })
})
