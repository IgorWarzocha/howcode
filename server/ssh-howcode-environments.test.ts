import { describe, expect, it } from 'vitest'
import { sshHowcodeEnvironmentInternals } from './ssh-howcode-environments'

const urlSafePattern = /^[\w-]+$/

const baseConfig = {
  host: 'howaclawa@192.168.0.113',
  localPort: 0,
  remoteCommand: null,
  remotePort: 39317,
  token: 'secret-token',
}

describe('ssh howcode environment internals', () => {
  it('parses the last non-empty launch JSON line', () => {
    expect(
      sshHowcodeEnvironmentInternals.parseRemoteLaunchResult(
        'noise\n{"remotePort":39319,"serverKind":"managed"}\n',
      ),
    ).toEqual({ remotePort: 39319, serverKind: 'managed' })
  })

  it('builds a launch script with remote state and dynamic port scanning', () => {
    const script = sshHowcodeEnvironmentInternals.buildRemoteLaunchScript(baseConfig)

    expect(script).toContain('$HOME/.howcode/ssh-launch/$STATE_KEY')
    expect(script).toContain('pick_port()')
    expect(script).toContain('server.log')
    expect(script).toContain('"serverKind":"%s"')
  })

  it('supports remote command port and token placeholders', () => {
    const script = sshHowcodeEnvironmentInternals.buildRemoteRunnerScript({
      ...baseConfig,
      remoteCommand: 'howcode serve --port @@PORT@@ --token @@TOKEN@@',
    })

    expect(script).toContain('REMOTE_PORT="$1"')
    expect(script).toContain('TOKEN="$2"')
    expect(script).toContain('howcode serve --port "$REMOTE_PORT" --token "$TOKEN"')
  })

  it('creates stable url-safe remote state keys', () => {
    expect(sshHowcodeEnvironmentInternals.remoteStateKey(baseConfig.host)).toMatch(urlSafePattern)
    expect(sshHowcodeEnvironmentInternals.remoteStateKey(baseConfig.host)).toBe(
      sshHowcodeEnvironmentInternals.remoteStateKey(baseConfig.host),
    )
  })
})
