import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { ensureNodePtyHelpersExecutable } from './node-pty-helper'

it('makes installed macOS helpers executable without changing their other permissions', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'howcode-node-pty-helper-'))
  try {
    const directory = path.join(root, 'prebuilds', 'darwin-arm64')
    mkdirSync(directory, { recursive: true })
    const helper = path.join(directory, 'spawn-helper')
    writeFileSync(helper, '')
    chmodSync(helper, 0o640)
    ensureNodePtyHelpersExecutable(root, 'arm64')
    expect(statSync(helper).mode & 0o777).toBe(0o751)
    ensureNodePtyHelpersExecutable(root, 'arm64')
    expect(statSync(helper).mode & 0o777).toBe(0o751)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
