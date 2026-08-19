import { lstat, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

export function isLegacyLinuxCommandLauncher(launcherContents: string) {
  const lines = launcherContents.trimEnd().split('\n')
  const executablePrefix = '    exec '
  const executableSuffix = ' --howcode-headless --ozone-platform=headless "$@"'
  const headlessCommand = lines[5]
  if (
    !(headlessCommand?.startsWith(executablePrefix) && headlessCommand.endsWith(executableSuffix))
  )
    return false
  const executable = headlessCommand.slice(executablePrefix.length, -executableSuffix.length)
  if (!(executable.includes('/versions/') && executable.endsWith("/howcode/howcode'"))) return false

  const expectedLines = [
    '#!/bin/sh',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Matches the generated legacy shell syntax.
    'export HOWCODE_REPO_ROOT=${HOWCODE_REPO_ROOT:-$(pwd)}',
    'if [ "$1" = "--headless" ] || [ "$HOWCODE_HEADLESS" = "1" ]; then',
    '  if [ "$1" = "--headless" ]; then',
    '    shift',
    `${executablePrefix}${executable}${executableSuffix}`,
    '  fi',
    `  exec ${executable} --ozone-platform=headless "$@"`,
    'fi',
    'if command -v setsid >/dev/null 2>&1; then',
    `  setsid -f ${executable} "$@" >/dev/null 2>&1 </dev/null`,
    'else',
    `  nohup ${executable} "$@" >/dev/null 2>&1 </dev/null &`,
    'fi',
    'exit 0',
  ]
  return (
    lines.length === expectedLines.length &&
    lines.every((line, index) => line === expectedLines[index])
  )
}

export async function removeLegacyLinuxCommandLauncher() {
  if (process.platform !== 'linux') return
  const launcherPath = path.join(
    getProcessEnvironmentVariable('XDG_BIN_HOME') ?? path.join(homedir(), '.local', 'bin'),
    'howcode',
  )
  try {
    const launcherStats = await lstat(launcherPath)
    if (!launcherStats.isFile()) return
    if (!isLegacyLinuxCommandLauncher(await readFile(launcherPath, 'utf8'))) return
    await rm(launcherPath, { force: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    console.warn(`[howcode updater] could not remove legacy command launcher: ${String(error)}`)
  }
}
