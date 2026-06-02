import { accessSync, constants } from 'node:fs'
import path from 'node:path'
import { getPersistedSessionPath } from '../../shared/session-paths'
import type { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getBundledThemes } from '../bundled-themes.ts'
import {
  ensureNativeExtensionRuntimePath,
  getNativeExtensionRuntimePaths,
  type HowcodeNativeExtensionId,
} from '../native-extensions/native-extension-paths.ts'
import { getSessionNativeExtensions, setSessionNativeExtensions } from '../thread-state-db.ts'

const howcodeNativeExtensionIds = ['askQuestions', 'smartBtw'] as const

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

type TerminalEnvironmentVariables = NodeJS.ProcessEnv & {
  TERM_PROGRAM?: string
  COLORTERM?: string
  HOWCODE_EMBEDDED_TERMINAL?: string
  HOWCODE_TERMINAL_CAPABILITIES?: string
  PI_CLEAR_ON_SHRINK?: string
}

function getEnvironmentVariable(env: NodeJS.ProcessEnv, name: string) {
  return env[name]
}

function getDefaultNativeExtensions(): HowcodeNativeExtensionId[] {
  const settings = loadAppSettings()
  return [
    ...(settings.howcodeNativeAskQuestions ? (['askQuestions'] as const) : []),
    ...(settings.howcodeNativeSmartBtw ? (['smartBtw'] as const) : []),
  ]
}

function getPiSessionNativeExtensions(sessionPath: string | null): HowcodeNativeExtensionId[] {
  const sessionExtensions = getSessionNativeExtensions(sessionPath)
  if (sessionExtensions)
    return sessionExtensions.filter((id): id is HowcodeNativeExtensionId =>
      howcodeNativeExtensionIds.includes(id as HowcodeNativeExtensionId),
    )
  const defaultExtensions = getDefaultNativeExtensions()
  if (sessionPath) setSessionNativeExtensions(sessionPath, defaultExtensions)
  return defaultExtensions
}

function getPiSessionCommandArgs(sessionPath: string | null | undefined) {
  const persistedSessionPath = getPersistedSessionPath(sessionPath)
  const enabledNativeExtensions = getPiSessionNativeExtensions(persistedSessionPath)
  const args = persistedSessionPath ? ['--session', persistedSessionPath] : []
  for (const theme of getBundledThemes()) {
    args.push('--theme', theme.path)
  }
  if (enabledNativeExtensions.includes('askQuestions')) {
    args.push('--extension', ensureNativeExtensionRuntimePath('askQuestions'))
  }
  for (const extensionPath of getNativeExtensionRuntimePaths(
    enabledNativeExtensions.filter((id) => id !== 'askQuestions'),
  )) {
    args.push('--extension', extensionPath)
  }
  return args
}

function getPiSessionShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv) {
  return platform === 'win32'
    ? findExecutable('pi.cmd', getEnvironmentVariable(env, 'PATH') ?? '')
    : findExecutable('pi', getEnvironmentVariable(env, 'PATH') ?? '')
}

const hostTerminalCapabilityEnvKeys = [
  'GHOSTTY_RESOURCES_DIR',
  'ITERM_SESSION_ID',
  'KITTY_WINDOW_ID',
  'TERM_PROGRAM',
  'WEZTERM_PANE',
]

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

  if (request.launchMode === 'pi-session') {
    return {
      shell: getPiSessionShell(platform, env),
      args: getPiSessionCommandArgs(request.sessionPath),
    }
  }

  if (platform === 'win32') {
    return {
      shell: getEnvironmentVariable(env, 'COMSPEC') || 'powershell.exe',
      args: [] as string[],
    }
  }

  return {
    shell: getEnvironmentVariable(env, 'SHELL') || '/bin/bash',
    args: ['-i'],
  }
}

export function resolveTerminalEnv(
  request: TerminalOpenRequest,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: getEnvironmentVariable(env, 'COLORTERM') ?? 'truecolor',
  }
  const nextEnvVariables = nextEnv as TerminalEnvironmentVariables

  if (request.launchMode !== 'pi-session') {
    return nextEnv
  }

  for (const key of hostTerminalCapabilityEnvKeys) {
    delete nextEnv[key]
  }

  nextEnvVariables.TERM_PROGRAM = 'howcode'
  nextEnvVariables.HOWCODE_EMBEDDED_TERMINAL = '1'
  nextEnvVariables.HOWCODE_TERMINAL_CAPABILITIES =
    'ansi,256color,truecolor,unicode,no-terminal-protocols'
  nextEnvVariables.PI_CLEAR_ON_SHRINK = '1'
  return nextEnv
}
