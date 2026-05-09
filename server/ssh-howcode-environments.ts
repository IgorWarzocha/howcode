import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer, Socket } from 'node:net'
import WebSocket from 'ws'
import { HOWCODE_RPC_METHODS, HOWCODE_RPC_WS_PATH } from '../shared/howcode-rpc'
import {
  HOWCODE_SERVER_FINGERPRINT,
  type HowcodeEnvironment,
} from '../shared/howcode-server-contracts'

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
  serverKind: RemoteServerKind
  close: () => void
}

type ManagedSshProcess = {
  child: ChildProcess
  label: string
  recentOutput: () => string
}

type RemoteServerKind = 'external' | 'managed'

type RemoteLaunchResult = {
  remotePort: number
  serverKind: RemoteServerKind
}

const remotePortScanWindow = 200
const activeConnections = new Map<string, SshHowcodeEnvironmentConnection>()
const pendingConnections = new Map<string, Promise<SshHowcodeEnvironmentConnection>>()

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

function redactSensitiveText(text: string, token: string) {
  return token ? text.replaceAll(token, '[redacted-token]') : text
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

function normalizeSshTarget(host: string) {
  return host.trim().toLowerCase()
}

function remoteStateKey(host: string) {
  return Buffer.from(normalizeSshTarget(host)).toString('base64url').slice(0, 80)
}

function buildRemoteRunnerScript(config: SshHowcodeEnvironmentConfig) {
  if (config.remoteCommand?.trim()) {
    const template = config.remoteCommand.trim()
    return [
      '#!/bin/sh',
      'set -eu',
      `REMOTE_PORT="$1"`,
      `TOKEN="$2"`,
      template.replaceAll('@@PORT@@', '"$REMOTE_PORT"').replaceAll('@@TOKEN@@', '"$TOKEN"'),
    ].join('\n')
  }

  return [
    '#!/bin/sh',
    'set -eu',
    'REMOTE_PORT="$1"',
    'TOKEN="$2"',
    'export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin:$PATH"',
    [
      'if [ -z "$',
      '{SHELL:-}" ] || [ ! -x "$',
      '{SHELL:-}" ]; then if command -v bash >/dev/null 2>&1; then SHELL="$(command -v bash)"; else SHELL="/bin/sh"; fi; fi',
    ].join(''),
    'export SHELL',
    'if [ -d "$HOME/howcode" ]; then cd "$HOME/howcode" && git fetch origin issue-226-server-mode-research && git reset --hard origin/issue-226-server-mode-research && bun install --frozen-lockfile && bun run build:runtime && export PATH="$PWD/node_modules/.bin:$PATH" && export PI_PACKAGE_DIR="$PWD/node_modules/@earendil-works/pi-coding-agent" && export HOWCODE_INSTANCE_NAME=' +
      shellQuote(config.host) +
      ' && exec env HOWCODE_RUNTIME_ROOT=. ELECTRON_RUN_AS_NODE=1 electron build/desktop/standalone-howcode-server.mjs --port "$REMOTE_PORT" --token "$TOKEN"; fi',
    'if command -v howcode >/dev/null 2>&1; then exec howcode serve --host 127.0.0.1 --port "$REMOTE_PORT" --token "$TOKEN"; fi',
    'echo "Unable to find howcode. Install the howcode CLI or clone the repo to ~/howcode." >&2',
    'exit 127',
  ].join('\n')
}

function buildRemoteLaunchScript(config: SshHowcodeEnvironmentConfig) {
  const runnerScript = buildRemoteRunnerScript(config)
  return `set -eu
STATE_KEY="$1"
DEFAULT_REMOTE_PORT="$2"
SCAN_WINDOW="$3"
TOKEN="$4"
STATE_DIR="$HOME/.howcode/ssh-launch/$STATE_KEY"
FINGERPRINT="${HOWCODE_SERVER_FINGERPRINT}"
FINGERPRINT_FILE="$STATE_DIR/fingerprint"
PORT_FILE="$STATE_DIR/port"
PID_FILE="$STATE_DIR/pid"
MANAGED_FILE="$STATE_DIR/managed"
LOG_FILE="$STATE_DIR/server.log"
RUNNER_FILE="$STATE_DIR/run-howcode.sh"
RUNNER_NEXT="$STATE_DIR/run-howcode.next.$$"
mkdir -p "$STATE_DIR"
cleanup_runner_next() { rm -f "$RUNNER_NEXT"; }
trap cleanup_runner_next EXIT
cat >"$RUNNER_NEXT" <<'HOWCODE_RUNNER'
${runnerScript}
HOWCODE_RUNNER
RUNNER_CHANGED=0
if [ ! -f "$RUNNER_FILE" ] || ! cmp -s "$RUNNER_NEXT" "$RUNNER_FILE"; then RUNNER_CHANGED=1; fi
mv "$RUNNER_NEXT" "$RUNNER_FILE"
chmod 700 "$RUNNER_FILE"
pick_port() {
  node - "$PORT_FILE" "$DEFAULT_REMOTE_PORT" "$SCAN_WINDOW" <<'NODE'
const fs = require('node:fs')
const net = require('node:net')
const filePath = process.argv[2] || ''
const defaultPort = Number.parseInt(process.argv[3] || '', 10)
const scanWindow = Number.parseInt(process.argv[4] || '', 10)
const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : ''
const preferred = Number.parseInt(raw, 10)
const start = Number.isInteger(preferred) ? preferred : defaultPort
const end = start + scanWindow
function tryPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close((error) => resolve(error ? false : port)))
  })
}
;(async () => {
  for (let port = start; port < end; port += 1) {
    const available = await tryPort(port)
    if (available) {
      process.stdout.write(String(port))
      return
    }
  }
  process.exit(1)
})().catch(() => process.exit(1))
NODE
}
wait_ready() {
  node - "$REMOTE_PORT" "$1" <<'NODE'
const http = require('node:http')
const port = Number.parseInt(process.argv[2] || '', 10)
const timeoutMs = Number.parseInt(process.argv[3] || '', 10)
const deadline = Date.now() + timeoutMs
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function probe() {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/healthz', timeout: 1000 }, (res) => {
      res.resume()
      res.once('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300))
    })
    req.once('timeout', () => { req.destroy(); resolve(false) })
    req.once('error', () => resolve(false))
  })
}
;(async () => {
  while (Date.now() < deadline) {
    if (await probe()) process.exit(0)
    await sleep(100)
  }
  process.exit(1)
})().catch(() => process.exit(1))
NODE
}
wait_for_pid_exit() {
  PID_TO_WAIT="$1"
  WAIT_COUNT=0
  while kill -0 "$PID_TO_WAIT" 2>/dev/null && [ "$WAIT_COUNT" -lt 20 ]; do WAIT_COUNT=$((WAIT_COUNT + 1)); sleep 0.1; done
}
REMOTE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
REMOTE_PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
REMOTE_MANAGED="$(cat "$MANAGED_FILE" 2>/dev/null || true)"
REMOTE_FINGERPRINT="$(cat "$FINGERPRINT_FILE" 2>/dev/null || true)"
if [ "$REMOTE_MANAGED" = "managed" ] && [ -n "$REMOTE_PID" ] && [ -n "$REMOTE_PORT" ] && kill -0 "$REMOTE_PID" 2>/dev/null; then
  if [ "$RUNNER_CHANGED" -eq 1 ] || [ "$REMOTE_FINGERPRINT" != "$FINGERPRINT" ] || ! wait_ready 2000; then
    kill "$REMOTE_PID" 2>/dev/null || true
    wait_for_pid_exit "$REMOTE_PID"
    REMOTE_PID=""
    REMOTE_PORT=""
    REMOTE_MANAGED=""
  fi
else
  REMOTE_PID=""
  REMOTE_PORT=""
  REMOTE_MANAGED=""
fi
if [ -z "$REMOTE_PID" ] || [ -z "$REMOTE_PORT" ]; then
  REMOTE_PORT="$DEFAULT_REMOTE_PORT"
  if wait_ready 1000; then
    printf '%s
' "$REMOTE_PORT" >"$PORT_FILE"
    printf 'external
' >"$MANAGED_FILE"
    printf '{"remotePort":%s,"serverKind":"external"}
' "$REMOTE_PORT"
    exit 0
  fi
  REMOTE_PORT="$(pick_port)" || true
  if [ -z "$REMOTE_PORT" ]; then echo 'Failed to find an available remote port.' >&2; exit 1; fi
  nohup "$RUNNER_FILE" "$REMOTE_PORT" "$TOKEN" >>"$LOG_FILE" 2>&1 < /dev/null &
  REMOTE_PID="$!"
  printf '%s\n' "$REMOTE_PID" >"$PID_FILE"
  printf '%s\n' "$REMOTE_PORT" >"$PORT_FILE"
  printf 'managed\n' >"$MANAGED_FILE"
  printf '%s\n' "$FINGERPRINT" >"$FINGERPRINT_FILE"
  REMOTE_MANAGED="managed"
  if ! wait_ready 15000; then
    echo "Remote Howcode server did not become ready on 127.0.0.1:$REMOTE_PORT." >&2
    tail -n 80 "$LOG_FILE" >&2 2>/dev/null || true
    kill "$REMOTE_PID" 2>/dev/null || true
    wait_for_pid_exit "$REMOTE_PID"
    rm -f "$PID_FILE" "$PORT_FILE" "$MANAGED_FILE" "$FINGERPRINT_FILE"
    exit 1
  fi
fi
printf '{"remotePort":%s,"serverKind":"%s"}\n' "$REMOTE_PORT" "\${REMOTE_MANAGED:-managed}"
`
}

function buildRemoteStopScript(config: SshHowcodeEnvironmentConfig) {
  return `set -eu
STATE_DIR="$HOME/.howcode/ssh-launch/${remoteStateKey(config.host)}"
PID_FILE="$STATE_DIR/pid"
MANAGED_FILE="$STATE_DIR/managed"
REMOTE_MANAGED="$(cat "$MANAGED_FILE" 2>/dev/null || true)"
REMOTE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ "$REMOTE_MANAGED" = "managed" ] && [ -n "$REMOTE_PID" ] && kill -0 "$REMOTE_PID" 2>/dev/null; then
  kill "$REMOTE_PID" 2>/dev/null || true
fi
rm -f "$PID_FILE" "$STATE_DIR/port" "$MANAGED_FILE" "$STATE_DIR/fingerprint"
printf '{"stopped":true}\n'
`
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
  try {
    await waitForAuthenticatedServer(baseUrl, token, 750)
    return true
  } catch {
    return false
  }
}

async function probeAuthenticatedServerRpc(baseUrl: string, token: string) {
  await new Promise<void>((resolve, reject) => {
    const requestId = randomUUID()
    const url = new URL(HOWCODE_RPC_WS_PATH, baseUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('token', token)
    const webSocket = new WebSocket(url)
    const timeout = setTimeout(() => {
      cleanup()
      webSocket.close()
      reject(new Error('RPC probe timed out.'))
    }, 1000)
    const cleanup = () => {
      clearTimeout(timeout)
      webSocket.off('open', onOpen)
      webSocket.off('message', onMessage)
      webSocket.off('error', onError)
    }
    const onOpen = () => {
      webSocket.send(
        JSON.stringify({
          id: requestId,
          type: HOWCODE_RPC_METHODS.appRequest,
          channel: 'getHowcodeInstanceManifest',
          params: {},
        }),
      )
    }
    const onMessage = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as { id?: string; ok?: boolean; error?: string }
      if (message.id !== requestId) return
      cleanup()
      webSocket.close(1000)
      if (message.ok) resolve()
      else reject(new Error(message.error ?? 'RPC manifest probe failed.'))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    webSocket.on('open', onOpen)
    webSocket.on('message', onMessage)
    webSocket.on('error', onError)
  })
}

async function waitForAuthenticatedServer(baseUrl: string, token: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      const descriptor = await fetch(`${baseUrl}/.well-known/howcode/server`)
      if (descriptor.ok) {
        await probeAuthenticatedServerRpc(baseUrl, token)
        return
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(
    `Timed out waiting for authenticated Howcode server at ${baseUrl}${lastError instanceof Error ? `: ${lastError.message}` : ''}`,
  )
}

async function runSshScript(config: SshHowcodeEnvironmentConfig, script: string, args: string[]) {
  const child = spawn('ssh', ['-o', 'BatchMode=yes', config.host, 'sh', '-s', '--', ...args], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    stderr += text
    process.stderr.write(`[howcode-ssh-script] ${redactSensitiveText(text, config.token)}`)
  })
  child.stdin?.end(script)
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve({ code, signal }))
    },
  )
  if (exit.code !== 0) {
    throw new Error(
      `SSH script failed (${exit.code ?? exit.signal ?? 'error'}): ${redactSensitiveText(stderr.trim() || stdout.trim(), config.token)}`,
    )
  }
  return stdout
}

function parseRemoteLaunchResult(stdout: string): RemoteLaunchResult {
  const line = stdout
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1)
  if (!line) throw new Error('SSH launch did not return a remote port.')
  const parsed = JSON.parse(line) as Partial<RemoteLaunchResult>
  const remotePort = parsed.remotePort
  if (typeof remotePort !== 'number' || !Number.isInteger(remotePort) || remotePort <= 0) {
    throw new Error(`SSH launch returned an invalid remote port: ${String(remotePort)}.`)
  }
  return {
    remotePort,
    serverKind: parsed.serverKind === 'external' ? 'external' : 'managed',
  }
}

function connectionKey(config: SshHowcodeEnvironmentConfig) {
  return [
    normalizeSshTarget(config.host),
    config.token,
    config.remotePort,
    config.remoteCommand ?? '',
  ].join('\0')
}

async function launchOrReuseRemoteServer(config: SshHowcodeEnvironmentConfig) {
  const stdout = await runSshScript(config, buildRemoteLaunchScript(config), [
    remoteStateKey(config.host),
    String(config.remotePort),
    String(remotePortScanWindow),
    config.token,
  ])
  return parseRemoteLaunchResult(stdout)
}

async function reserveLoopbackPort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close((error) => {
        if (error) reject(error)
        else if (port) resolve(port)
        else reject(new Error('Failed to reserve loopback port.'))
      })
    })
  })
}

async function isLoopbackPortListening(port: number) {
  return await new Promise<boolean>((resolve) => {
    const socket = new Socket()
    socket.setTimeout(250)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(false))
    socket.connect(port, '127.0.0.1')
  })
}

async function waitForTunnelAuthenticatedServer(options: {
  baseUrl: string
  token: string
  localPort: number
  remotePort: number
  tunnelProcess: ManagedSshProcess
}) {
  let exitResult: { code: number | null; signal: NodeJS.Signals | null } | null = null
  const tunnelExit = new Promise<never>((_resolve, reject) => {
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      exitResult = { code, signal }
      reject(
        new Error(
          `SSH tunnel exited during readiness (${code ?? signal ?? 'error'})${options.tunnelProcess.recentOutput()}`,
        ),
      )
    }
    options.tunnelProcess.child.once('exit', onExit)
  })

  try {
    await Promise.race([
      waitForAuthenticatedServer(options.baseUrl, options.token, 20_000),
      tunnelExit,
    ])
  } catch (error) {
    const listening = await isLoopbackPortListening(options.localPort)
    const running = !options.tunnelProcess.child.killed && exitResult === null
    throw new Error(
      [
        `SSH tunnel readiness failed for ${options.baseUrl}.`,
        `localPort=${options.localPort}`,
        `remotePort=${options.remotePort}`,
        `tunnelRunning=${running}`,
        `localPortListening=${listening}`,
        error instanceof Error ? error.message : String(error),
      ].join(' '),
    )
  }
}

export function readSshHowcodeEnvironmentConfigFromEnv(): SshHowcodeEnvironmentConfig | null {
  const host = getProcessEnvironmentVariable('HOWCODE_SSH_SERVER_HOST')?.trim()
  if (!host) return null
  return {
    host,
    localPort: parsePort(getProcessEnvironmentVariable('HOWCODE_SSH_LOCAL_PORT'), 0),
    remoteCommand: getProcessEnvironmentVariable('HOWCODE_SSH_REMOTE_COMMAND')?.trim() || null,
    remotePort: parsePort(getProcessEnvironmentVariable('HOWCODE_SSH_REMOTE_PORT'), 39317),
    token: getProcessEnvironmentVariable('HOWCODE_SSH_SERVER_TOKEN')?.trim() || randomUUID(),
  }
}

async function createSshHowcodeServerConnection(
  key: string,
  config: SshHowcodeEnvironmentConfig,
): Promise<SshHowcodeEnvironmentConnection> {
  const remoteServer = await launchOrReuseRemoteServer(config)
  const localPort = config.localPort || (await reserveLoopbackPort())
  const tunnelProcess = spawnManaged(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=15',
      '-o',
      'ServerAliveCountMax=3',
      '-n',
      '-N',
      '-L',
      `127.0.0.1:${localPort}:127.0.0.1:${remoteServer.remotePort}`,
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

  const baseUrl = `http://127.0.0.1:${localPort}`
  try {
    await waitForTunnelAuthenticatedServer({
      baseUrl,
      localPort,
      remotePort: remoteServer.remotePort,
      token: config.token,
      tunnelProcess,
    })
  } catch (error) {
    closeChild(tunnelProcess.child)
    throw error
  }

  const environment: HowcodeEnvironment = {
    id: `ssh:${config.host}`,
    kind: 'ssh-server',
    name: config.host,
    scope: 'global',
    serverUrl: baseUrl,
    ssh: {
      host: config.host,
      localPort,
      remotePort: remoteServer.remotePort,
      serverKind: remoteServer.serverKind,
    },
  }

  let closed = false
  return {
    baseUrl,
    environment,
    serverKind: remoteServer.serverKind,
    token: config.token,
    close: () => {
      if (closed) return
      closed = true
      if (activeConnections.get(key)?.baseUrl === baseUrl) {
        activeConnections.delete(key)
      }
      closeChild(tunnelProcess.child)
      if (remoteServer.serverKind === 'managed') {
        void runSshScript(config, buildRemoteStopScript(config), []).catch((error) => {
          console.warn('Failed to stop managed remote Howcode server', error)
        })
      }
    },
  }
}

export async function ensureSshHowcodeServer(
  config: SshHowcodeEnvironmentConfig,
): Promise<SshHowcodeEnvironmentConnection> {
  const key = connectionKey(config)
  const active = activeConnections.get(key) ?? null
  if (active && (await canReachAuthenticatedServer(active.baseUrl, active.token))) {
    return active
  }
  if (active) {
    active.close()
  }

  const pending = pendingConnections.get(key)
  if (pending) return pending

  const next = createSshHowcodeServerConnection(key, config)
  pendingConnections.set(key, next)
  try {
    const connection = await next
    activeConnections.set(key, connection)
    return connection
  } finally {
    pendingConnections.delete(key)
  }
}

export function disconnectSshHowcodeServer(config: SshHowcodeEnvironmentConfig) {
  const connection = activeConnections.get(connectionKey(config)) ?? null
  connection?.close()
}

export const sshHowcodeEnvironmentInternals = {
  buildRemoteLaunchScript,
  buildRemoteRunnerScript,
  connectionKey,
  parseRemoteLaunchResult,
  redactSensitiveText,
  normalizeSshTarget,
  remoteStateKey,
}
