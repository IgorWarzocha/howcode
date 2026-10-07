import { accessSync, constants } from 'node:fs'
import path from 'node:path'
import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'

const wslUncPathPattern = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\/]+)([\\/].*)?$/i

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getEnvironmentVariable(env: NodeJS.ProcessEnv, name: string) {
  return env[name]
}

function getSafeWindowsSpawnCwd(env: NodeJS.ProcessEnv) {
  return (
    getEnvironmentVariable(env, 'USERPROFILE') ||
    getEnvironmentVariable(env, 'SystemRoot') ||
    process.cwd()
  )
}

export function getWslTerminalLaunch(
  cwd: string | null | undefined,
  options?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv },
) {
  const platform = options?.platform ?? process.platform
  if (platform !== 'win32' || !cwd) return null

  const match = cwd.match(wslUncPathPattern)
  if (!match) return null

  const distro = match[1]
  const rawLinuxPath = match[2] ?? ''
  if (!distro) return null

  return {
    distro,
    linuxPath: rawLinuxPath ? rawLinuxPath.replaceAll('\\', '/') : '/',
    windowsSpawnCwd: getSafeWindowsSpawnCwd(options?.env ?? process.env),
  }
}

export function findExecutable(
  name: string,
  pathValue = getProcessEnvironmentVariable('PATH') ?? '',
) {
  const pathEntries = pathValue.split(path.delimiter)

  for (const entry of pathEntries) {
    if (!entry) {
      continue
    }

    const candidate = path.join(entry, name)

    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try next candidate.
    }
  }

  return name
}

export function resolveTerminalCommand(
  request: TerminalOpenRequest,
  options?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv },
) {
  const platform = options?.platform ?? process.platform
  const env = options?.env ?? process.env
  const wslLaunch = getWslTerminalLaunch(request.cwd, { platform, env })

  if (wslLaunch) {
    return {
      shell: findExecutable('wsl.exe', getEnvironmentVariable(env, 'PATH') ?? ''),
      args: ['-d', wslLaunch.distro, '--cd', wslLaunch.linuxPath],
      cwd: wslLaunch.windowsSpawnCwd,
    }
  }

  if (platform === 'win32') {
    return {
      shell: getEnvironmentVariable(env, 'COMSPEC') || 'powershell.exe',
      args: [] as string[],
      cwd: undefined,
    }
  }

  return {
    shell: getEnvironmentVariable(env, 'SHELL') || '/bin/bash',
    args: ['-i'],
    cwd: undefined,
  }
}

export function resolveTerminalEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: getEnvironmentVariable(env, 'COLORTERM') ?? 'truecolor',
  }
}
