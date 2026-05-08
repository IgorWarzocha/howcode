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

function spawnManaged(command: string, args: string[], label: string) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`)
  })
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`)
  })
  return child
}

function closeChild(child: ChildProcess | null) {
  if (!child || child.killed) return
  child.kill('SIGTERM')
}

function defaultRemoteServeCommand(config: SshHowcodeEnvironmentConfig) {
  return [
    'howcode',
    'serve',
    '--host',
    '127.0.0.1',
    '--port',
    String(config.remotePort),
    '--token',
    config.token,
  ].join(' ')
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
  const remoteCommand = config.remoteCommand ?? defaultRemoteServeCommand(config)
  const remoteServerProcess = spawnManaged('ssh', [config.host, remoteCommand], 'howcode-ssh-serve')
  const tunnelProcess = spawnManaged(
    'ssh',
    ['-N', '-L', `127.0.0.1:${config.localPort}:127.0.0.1:${config.remotePort}`, config.host],
    'howcode-ssh-tunnel',
  )
  const baseUrl = `http://127.0.0.1:${config.localPort}`
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
      closeChild(tunnelProcess)
      closeChild(remoteServerProcess)
    },
  }
}
