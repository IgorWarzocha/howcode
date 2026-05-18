import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { NODE_PTY_UNIX_TERMINAL_PATTERN, patchUnixTerminal, unpackAsarPath } =
  require('../../scripts/patch-node-pty-helper.cjs') as {
    NODE_PTY_UNIX_TERMINAL_PATTERN: string
    patchUnixTerminal: (unixTerminalPath: string) => { patched: boolean; reason?: string }
    unpackAsarPath: (value: string, marker: string) => string
  }

describe('node-pty helper packaging patch', () => {
  it('does not double-unpack an app.asar.unpacked path', () => {
    expect(
      unpackAsarPath(
        '/Applications/howcode.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper',
        'app.asar',
      ),
    ).toBe(
      '/Applications/howcode.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper',
    )
  })

  it('unpacks an app.asar path once', () => {
    expect(
      unpackAsarPath(
        '/Applications/howcode.app/Contents/Resources/app.asar/node_modules/node-pty/build/Release/spawn-helper',
        'app.asar',
      ),
    ).toBe(
      '/Applications/howcode.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper',
    )
  })

  it('patches node-pty unixTerminal helperPath resolution idempotently', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'howcode-node-pty-patch-'))
    const unixTerminalPath = path.join(tempDir, 'unixTerminal.js')
    writeFileSync(unixTerminalPath, `${NODE_PTY_UNIX_TERMINAL_PATTERN}\n`, 'utf8')

    expect(patchUnixTerminal(unixTerminalPath)).toEqual({ patched: true })
    expect(readFileSync(unixTerminalPath, 'utf8')).toContain(
      'return value.indexOf(unpacked) !== -1 ? value : value.replace(marker, unpacked);',
    )
    expect(patchUnixTerminal(unixTerminalPath)).toEqual({
      patched: false,
      reason: 'already-patched',
    })
  })
})
