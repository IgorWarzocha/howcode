import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { HowcodeEnvironment } from '../../../shared/howcode-server-contracts'

export type SshHowcodeEnvironmentConfig = {
  host: string
  localPort: number
  remotePort: number
  token: string
  remoteCommand?: string | null
}

export type SshHowcodeEnvironmentConnection = {
  environment: HowcodeEnvironment
  baseUrl: string
  token: string
  close: () => void
}

type ManagedSshProcess = {
  child: ChildProcess
  label: string
  recentOutput: () => string
}

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function parsePort(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`)
  }
  return port
}

function appendRecentOutput(lines: string[], chunk: unknown) {
  const text = String(chunk)
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed) lines.push(trimmed)
  }
  lines.splice(0, Math.max(0, lines.length - 8))
}

function formatRecentOutput(lines: string[]) {
  return lines.length > 0 ? `: ${lines.join(' · ')}` : ''
}

function spawnManaged(command: string, args: string[], label: string): ManagedSshProcess {
  const recentLines: string[] = []
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr?.on('data', (chunk) => {
    appendRecentOutput(recentLines, chunk)
    process.stderr.write(`[${label}] ${chunk}`)
  })
  child.stdout?.on('data', (chunk) => {
    appendRecentOutput(recentLines, chunk)
    process.stdout.write(`[${label}] ${chunk}`)
  })
  child.on('error', (error) => {
    appendRecentOutput(recentLines, error.message)
  })
  return {
    child,
    label,
    recentOutput: () => formatRecentOutput(recentLines),
  }
}

function closeChild(child: ChildProcess | null) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function defaultRemoteServeCommand(config: SshHowcodeEnvironmentConfig) {
  const serveArgs = [
    'serve',
    '--host',
    '127.0.0.1',
    '--port',
    shellQuote(String(config.remotePort)),
    '--token',
    shellQuote(config.token),
  ].join(' ')
  const serveArgsWithoutCommand = serveArgs.slice('serve '.length)
  const command = [
    'export PATH="$HOME/.bun/bin:$PATH"',
    `export SHELL="\${SHELL:-/bin/bash}"`,
    `if command -v howcode >/dev/null 2>&1; then exec howcode ${serveArgs}; fi`,
    `if [ -d "$HOME/howcode" ]; then cd "$HOME/howcode" && git fetch origin issue-226-server-mode-research && git reset --hard origin/issue-226-server-mode-research && bun install --frozen-lockfile && bun run build:runtime && export PATH="$PWD/node_modules/.bin:$PATH" && export PI_PACKAGE_DIR="$PWD/node_modules/@earendil-works/pi-coding-agent" && export HOWCODE_INSTANCE_NAME=${shellQuote(config.host)} && exec bun run server:dev -- ${serveArgsWithoutCommand}; fi`,
    'echo "Unable to find howcode. Install the howcode CLI or clone the repo to ~/howcode." >&2',
    'exit 127',
  ].join('; ')
  return `bash -lc ${shellQuote(command)}`
}

async function assertProcessDoesNotExitEarly(process: ManagedSshProcess, timeoutMs: number) {
  const exitResult = await new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
  } | null>((resolve) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve(null)
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timeout)
      process.child.off('exit', onExit)
      process.child.off('error', onError)
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ code, signal })
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ code: null, signal: null })
    }
    process.child.once('exit', onExit)
    process.child.once('error', onError)
  })

  if (!exitResult) return
  throw new Error(
    `${process.label} exited before it was ready (${exitResult.code ?? exitResult.signal ?? 'error'})${process.recentOutput()}`,
  )
}

async function canReachAuthenticatedServer(baseUrl: string, token: string) {
  const descriptor = await fetch(`${baseUrl}/.well-known/howcode/server`).catch(() => null)
  if (descriptor?.ok !== true) return false
  const response = await fetch(`${baseUrl}/api/app/request/getHowcodeInstanceManifest`, {
    body: '{}',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    method: 'POST',
  }).catch(() => null)
  return response?.ok === true
}

export function readSshHowcodeEnvironmentConfigFromEnv(): SshHowcodeEnvironmentConfig | null {
  const host = getProcessEnvironmentVariable('HOWCODE_SSH_SERVER_HOST')?.trim()
  if (!host) return null
  return {
    host,
    localPort: parsePort(getProcessEnvironmentVariable('HOWCODE_SSH_LOCAL_PORT'), 49317),
    remoteCommand: getProcessEnvironmentVariable('HOWCODE_SSH_REMOTE_COMMAND')?.trim() || null,
    remotePort: parsePort(getProcessEnvironmentVariable('HOWCODE_SSH_REMOTE_PORT'), 39317),
    token: getProcessEnvironmentVariable('HOWCODE_SSH_SERVER_TOKEN')?.trim() || randomUUID(),
  }
}

export async function ensureSshHowcodeServer(
  config: SshHowcodeEnvironmentConfig,
): Promise<SshHowcodeEnvironmentConnection> {
  const tunnelProcess = spawnManaged(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ExitOnForwardFailure=yes',
      '-N',
      '-L',
      `127.0.0.1:${config.localPort}:127.0.0.1:${config.remotePort}`,
      config.host,
    ],
    'howcode-ssh-tunnel',
  )

  try {
    await assertProcessDoesNotExitEarly(tunnelProcess, 750)
  } catch (error) {
    closeChild(tunnelProcess.child)
    throw error
  }

  const baseUrl = `http://127.0.0.1:${config.localPort}`
  let remoteServerProcess: ManagedSshProcess | null = null

  const shouldStartManagedServer = !(await canReachAuthenticatedServer(baseUrl, config.token))

  if (shouldStartManagedServer) {
    const remoteCommand = config.remoteCommand ?? defaultRemoteServeCommand(config)
    remoteServerProcess = spawnManaged(
      'ssh',
      ['-o', 'BatchMode=yes', config.host, remoteCommand],
      'howcode-ssh-serve',
    )

    try {
      await assertProcessDoesNotExitEarly(remoteServerProcess, 750)
    } catch (error) {
      closeChild(tunnelProcess.child)
      closeChild(remoteServerProcess?.child ?? null)
      throw error
    }
  }
  const environment: HowcodeEnvironment = {
    id: `ssh:${config.host}`,
    kind: 'ssh-server',
    name: config.host,
    scope: 'global',
    serverUrl: baseUrl,
    ssh: {
      host: config.host,
      localPort: config.localPort,
      remotePort: config.remotePort,
    },
  }

  return {
    baseUrl,
    environment,
    token: config.token,
    close: () => {
      closeChild(tunnelProcess.child)
      closeChild(remoteServerProcess?.child ?? null)
    },
  }
}
