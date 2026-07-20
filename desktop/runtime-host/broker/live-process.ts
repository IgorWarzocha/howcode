import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import {
  getBundledSkillsPath,
  getElectronResourcesPath,
  getNodeExecutable,
  getRuntimeHostPath,
} from '../client-environment.ts'
import type { RuntimeHostToMainMessage } from '../protocol.ts'
import {
  brokerError,
  type RuntimeHostProcessAdapter,
  type RuntimeHostProcessHandlers,
} from './types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRuntimeHostToMainMessage(value: unknown): value is RuntimeHostToMainMessage {
  if (!isRecord(value)) return false
  const { error, event, id, name, ok, type } = value
  if (typeof type !== 'string') return false
  switch (type) {
    case 'desktop-event': {
      if (!isRecord(event)) return false
      const { type: eventType } = event
      return typeof eventType === 'string'
    }
    case 'host-error':
      return typeof error === 'string'
    case 'main-request':
      return typeof id === 'string' && typeof name === 'string'
    case 'response':
      return typeof id === 'string' && typeof ok === 'boolean'
    default:
      return false
  }
}

function terminateChildProcess(child: ChildProcess | null | undefined) {
  if (!child || child.killed || child.exitCode !== null) return

  if (process.platform === 'win32' && child.pid) {
    const taskkill = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    taskkill.unref()
    return
  }

  child.kill('SIGTERM')
}

function spawnRuntimeHost(
  nodeExecutable: string,
  label: string,
  handlers: RuntimeHostProcessHandlers<ChildProcess>,
) {
  return Effect.try({
    try: () => {
      const { PI_CODING_AGENT_DIR: configuredPiDirectory } = process.env
      const customPiDirectory = configuredPiDirectory?.trim()
      const child = spawn(nodeExecutable, [getRuntimeHostPath()], {
        cwd: getDesktopWorkingDirectory(),
        env: {
          ...process.env,
          HOWCODE_HANDLE_LOCAL_HOST_REQUESTS: '1',
          HOWCODE_REPO_ROOT: getDesktopWorkingDirectory(),
          HOWCODE_ELECTRON_RESOURCES_PATH: getElectronResourcesPath(),
          HOWCODE_BUNDLED_SKILLS_PATH: getBundledSkillsPath(),
          ...(customPiDirectory ? { PI_CODING_AGENT_DIR: customPiDirectory } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })

      const ready = new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      child.once('exit', (code, signal) => handlers.onExit(child, code, signal))
      child.on('message', (message: unknown) => {
        if (isRuntimeHostToMainMessage(message)) handlers.onMessage(child, message)
      })
      child.stdout?.on('data', (chunk: Buffer | string) =>
        process.stdout.write(`[pi-host:${label}] ${chunk}`),
      )
      child.stderr?.on('data', (chunk: Buffer | string) =>
        process.stderr.write(`[pi-host:${label}] ${chunk}`),
      )

      return {
        process: child,
        ready: Effect.tryPromise({
          try: () => ready,
          catch: (error) => brokerError('spawn', error),
        }),
      }
    },
    catch: (error) => brokerError('spawn', error),
  })
}

export const liveProcessAdapter: RuntimeHostProcessAdapter<ChildProcess> = {
  makeId: randomUUID,
  spawn: (label, handlers) =>
    Effect.tryPromise({
      try: getNodeExecutable,
      catch: (error) => brokerError('resolveNodeExecutable', error),
    }).pipe(Effect.flatMap((nodeExecutable) => spawnRuntimeHost(nodeExecutable, label, handlers))),
  send: (child, message) =>
    Effect.callback<void, ReturnType<typeof brokerError>>((resume) => {
      child.send(message, (error) => {
        resume(error ? Effect.fail(brokerError('send', error)) : Effect.void)
      })
    }),
  terminate: (child) => Effect.sync(() => terminateChildProcess(child)),
  terminateNow: terminateChildProcess,
  isRunning: (child) => !child.killed && child.exitCode === null,
  installShutdownHandlers: (terminateAll) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const exit = () => terminateAll()
        const sigterm = () => {
          terminateAll()
          process.exit(0)
        }
        const sigint = () => {
          terminateAll()
          process.exit(0)
        }
        process.once('exit', exit)
        process.once('SIGTERM', sigterm)
        process.once('SIGINT', sigint)
        return { exit, sigint, sigterm }
      }),
      ({ exit, sigint, sigterm }) =>
        Effect.sync(() => {
          process.off('exit', exit)
          process.off('SIGTERM', sigterm)
          process.off('SIGINT', sigint)
        }),
    ).pipe(Effect.asVoid),
}
