import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { removeObsoleteCommandLaunchIntegration } = require('../lib/integration.js') as {
  removeObsoleteCommandLaunchIntegration: (target: { os: string }) => Promise<boolean>
}

const originalXdgBinHome = process.env.XDG_BIN_HOME
let temporaryRoot: string | null = null

afterEach(async () => {
  if (originalXdgBinHome === undefined) delete process.env.XDG_BIN_HOME
  else process.env.XDG_BIN_HOME = originalXdgBinHome
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = null
})

async function setTemporaryBinHome() {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'howcode-launcher-test-'))
  process.env.XDG_BIN_HOME = temporaryRoot
  return path.join(temporaryRoot, 'howcode')
}

describe('Linux command launcher cleanup', () => {
  it('removes only the obsolete generated wrapper', async () => {
    const launcherPath = await setTemporaryBinHome()
    const executable = "'/home/test/.cache/howcode/versions/dev-0.1.67-abc/howcode/howcode'"
    await writeFile(
      launcherPath,
      [
        '#!/bin/sh',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Reproduces the generated legacy shell syntax.
        'export HOWCODE_REPO_ROOT=${HOWCODE_REPO_ROOT:-$(pwd)}',
        'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
        '  if [ "$1" = "--headless" ]; then',
        '    shift',
        `    exec ${executable} --howcode-headless --ozone-platform=headless "$@"`,
        '  fi',
        `  exec ${executable} --ozone-platform=headless "$@"`,
        'fi',
        'if command -v setsid >/dev/null 2>&1; then',
        `  setsid -f ${executable} "$@" >/dev/null 2>&1 </dev/null`,
        'else',
        `  nohup ${executable} "$@" >/dev/null 2>&1 </dev/null &`,
        'fi',
        'exit 0',
      ].join('\n'),
    )

    await expect(removeObsoleteCommandLaunchIntegration({ os: 'linux' })).resolves.toBe(true)
    await expect(lstat(launcherPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves unrelated files and package-manager symlinks', async () => {
    const launcherPath = await setTemporaryBinHome()
    await writeFile(
      launcherPath,
      [
        '#!/bin/sh',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Exercises a partial legacy-wrapper match.
        'export HOWCODE_REPO_ROOT=${HOWCODE_REPO_ROOT:-$(pwd)}',
        'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
        'echo --howcode-headless --ozone-platform=headless',
      ].join('\n'),
    )
    await removeObsoleteCommandLaunchIntegration({ os: 'linux' })
    await expect(readFile(launcherPath, 'utf8')).resolves.toContain('echo --howcode-headless')

    await rm(launcherPath)
    const packageBin = path.join(temporaryRoot ?? '', 'package-howcode')
    await writeFile(packageBin, '#!/usr/bin/env node\n')
    await symlink(packageBin, launcherPath)
    await removeObsoleteCommandLaunchIntegration({ os: 'linux' })
    await expect(lstat(launcherPath).then((stats) => stats.isSymbolicLink())).resolves.toBe(true)
  })
})
