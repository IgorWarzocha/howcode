import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  isUpdateCandidate,
  normalizeReleaseMetadata,
} from '../electron/main/updater/update-protocol'

const hash = 'a'.repeat(64)

describe('app update protocol', () => {
  it('accepts legacy manifests while validating v2 channel metadata', () => {
    const release = normalizeReleaseMetadata(
      { version: '1.2.3', hash },
      'https://example.test/channel-dev/stable-linux-x64-update.json',
      'https://example.test/channel-dev',
      'dev',
      'https://example.test/channel-dev/howcode-linux-x64.tar.gz',
    )

    expect(release).toEqual({
      version: '1.2.3',
      hash,
      assetUrl: 'https://example.test/channel-dev/howcode-linux-x64.tar.gz',
    })
  })

  it('rejects a manifest that escapes the release origin or channel', () => {
    expect(() =>
      normalizeReleaseMetadata(
        { protocolVersion: 2, channel: 'main', version: '1.2.3', hash },
        'https://example.test/channel-dev/stable-linux-x64-update.json',
        'https://example.test/channel-dev',
        'dev',
        'https://example.test/channel-dev/howcode-linux-x64.tar.gz',
      ),
    ).toThrow('channel mismatch')

    expect(() =>
      normalizeReleaseMetadata(
        {
          protocolVersion: 2,
          channel: 'dev',
          version: '1.2.3',
          hash,
          assetUrl: 'https://attacker.test/howcode.tar.gz',
        },
        'https://example.test/channel-dev/stable-linux-x64-update.json',
        'https://example.test/channel-dev',
        'dev',
        'https://example.test/channel-dev/howcode-linux-x64.tar.gz',
      ),
    ).toThrow('untrusted asset URL')
  })

  it('bridges installer builds once and detects later same-version rebuilds by hash', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(isUpdateCandidate('1.2.3', { version: '1.2.3', hash: 'b'.repeat(64) }, null)).toBe(true)
    expect(
      isUpdateCandidate(
        '1.2.3',
        { version: '1.2.3', hash: 'b'.repeat(64) },
        { version: '1.2.3', hash },
      ),
    ).toBe(true)
    expect(isUpdateCandidate('1.2.3', { version: '1.2.3', hash }, { version: '1.2.3', hash })).toBe(
      false,
    )
    expect(isUpdateCandidate('1.2.3', { version: '1.2.2', hash }, null)).toBe(false)
  })
})
