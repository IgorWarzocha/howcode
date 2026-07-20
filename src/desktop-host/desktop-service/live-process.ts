import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as Effect from 'effect/Effect'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { DesktopServiceMessageSchema } from '../../../shared/desktop-service-ipc'
import { prepareServiceNativeRuntime } from '../service-native-runtime'
import {
  type DesktopServiceClientOptions,
  type DesktopServiceProcessAdapter,
  serviceError,
} from './types'

const TERMINATION_WAIT_MS = 1_500

const decodeDesktopServiceMessage = Schema.decodeUnknownResult(DesktopServiceMessageSchema)

function resolveNodeExecutable(options: DesktopServiceClientOptions) {
  return Effect.tryPromise({
    try: async () =>
      typeof options.nodeExecutable === 'function'
        ? await options.nodeExecutable()
        : options.nodeExecutable,
    catch: (error) => serviceError('resolveNodeExecutable', error),
  })
}

function prepareNodeRuntime(options: DesktopServiceClientOptions, nodeExecutable: string) {
  return Effect.tryPromise({
    try: () =>
      prepareServiceNativeRuntime({
        nodeExecutable,
        // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
        resourcesPath: options.env?.['HOWCODE_ELECTRON_RESOURCES_PATH'],
      }),
    catch: (error) => serviceError('prepareNativeRuntime', error),
  })
}

function spawnServiceProcess(
  options: DesktopServiceClientOptions,
  nodeExecutable: string,
  nodeRuntime: { readonly abi: string; readonly version: string },
  handlers: Parameters<DesktopServiceProcessAdapter<ChildProcess>['spawn']>[0],
) {
  return Effect.try({
    try: () => {
      const child = spawn(nodeExecutable, [options.serviceHostPath], {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
          HOWCODE_HANDLE_LOCAL_HOST_REQUESTS: '1',
          HOWCODE_REPO_ROOT: options.cwd,
          HOWCODE_SERVICE_NODE_ABI: nodeRuntime.abi,
          HOWCODE_SERVICE_NODE_VERSION: nodeRuntime.version,
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })

      let settled = false
      const ready = new Promise<Record<string, unknown>>((resolve, reject) => {
        child.once('error', (error) => {
          if (settled) return
          settled = true
          reject(error)
        })
        child.once('exit', () => {
          if (settled) return
          settled = true
          reject(new Error('Desktop service exited before startup.'))
        })
        child.on('message', (message: unknown) => {
          const decoded = decodeDesktopServiceMessage(message)
          if (Result.isFailure(decoded)) {
            process.stderr.write(
              `Ignored invalid desktop service IPC message: ${decoded.failure}\n`,
            )
            return
          }
          handlers.onMessage(child, decoded.success)
          if (decoded.success.type !== 'ready' || settled) return
          settled = true
          resolve(decoded.success.diagnostics ?? {})
        })
      })

      child.once('exit', (code, signal) => handlers.onExit(child, code, signal))
      child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
      child.stderr?.on('data', (chunk) => process.stderr.write(chunk))

      return {
        process: child,
        ready: Effect.tryPromise({
          try: () => ready,
          catch: (error) => serviceError('awaitReady', error),
        }),
      }
    },
    catch: (error) => serviceError('spawn', error),
  })
}

function terminateProcess(child: ChildProcess) {
  return Effect.callback<void>((resume) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resume(Effect.void)
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.off('exit', finish)
      resume(Effect.void)
    }
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL')
        } catch {
          // The process may have exited between the running check and kill.
        }
      }
      finish()
    }, TERMINATION_WAIT_MS)
    timer.unref?.()
    child.once('exit', finish)
    try {
      child.kill('SIGTERM')
    } catch {
      finish()
    }
    return Effect.sync(() => {
      clearTimeout(timer)
      child.off('exit', finish)
    })
  })
}

export function makeLiveProcessAdapter(
  options: DesktopServiceClientOptions,
): DesktopServiceProcessAdapter<ChildProcess> {
  return {
    makeRequestId: randomUUID,
    spawn: (handlers) =>
      resolveNodeExecutable(options).pipe(
        Effect.flatMap((nodeExecutable) =>
          prepareNodeRuntime(options, nodeExecutable).pipe(
            Effect.flatMap((nodeRuntime) =>
              spawnServiceProcess(options, nodeExecutable, nodeRuntime, handlers),
            ),
          ),
        ),
      ),
    send: (child, message) =>
      Effect.callback<void, ReturnType<typeof serviceError>>((resume) => {
        if (!child.connected) {
          resume(
            Effect.fail(
              serviceError('send', new Error('Desktop service IPC channel is disconnected.')),
            ),
          )
          return
        }
        try {
          child.send(message, (error) =>
            resume(error ? Effect.fail(serviceError('send', error)) : Effect.void),
          )
        } catch (error) {
          resume(Effect.fail(serviceError('send', error)))
        }
      }),
    terminate: terminateProcess,
    isRunning: (child) => !child.killed && child.exitCode === null,
  }
}
