import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { DesktopEvent } from '../../shared/desktop-contracts'
import type { DesktopServiceRuntime } from '../../shared/desktop-service-contracts'
import type { TerminalRpcResponse } from '../../shared/terminal-rpc'
import { prepareServiceNativeRuntime } from './service-native-runtime'
import { TerminalRpcServiceClient } from './terminal-rpc-client'

export type DesktopServiceApi = DesktopServiceRuntime
export type DesktopServiceModuleName = keyof DesktopServiceApi
type ServiceMethod<M extends DesktopServiceModuleName> = {
  [K in keyof DesktopServiceApi[M]]: DesktopServiceApi[M][K] extends (...args: never[]) => unknown
    ? K
    : never
}[keyof DesktopServiceApi[M]]
type ServiceFunction<M extends DesktopServiceModuleName, K extends ServiceMethod<M>> = Extract<
  DesktopServiceApi[M][K],
  (...args: never[]) => unknown
>

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export type DesktopServiceMessage =
  | { type: 'ready'; diagnostics?: Record<string, unknown> }
  | { type: 'response'; id: string; ok: boolean; result?: unknown; error?: string; stack?: string }
  | { type: 'desktop-event'; event: DesktopEvent }
  | { type: 'terminal-rpc-response'; message: TerminalRpcResponse }

export type DesktopServiceClientOptions = {
  nodeExecutable: string | (() => Promise<string> | string)
  serviceHostPath: string
  cwd: string
  env?: NodeJS.ProcessEnv | undefined
  requestTimeoutMs?: number | undefined
  startupTimeoutMs?: number | undefined
}

const defaultRequestTimeoutMs = 60_000
const defaultStartupTimeoutMs = 15_000

function createDesktopServiceDiagnosticEvent(input: {
  severity: 'warning' | 'error'
  message: string
  details?: unknown
}): DesktopEvent {
  return {
    type: 'runtime-diagnostic',
    severity: input.severity,
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

export class DesktopServiceClient {
  private readonly options: DesktopServiceClientOptions
  private process: ChildProcess | null = null
  private startPromise: Promise<ChildProcess> | null = null
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly desktopListeners = new Set<(event: DesktopEvent) => void>()
  private readonly terminalRpc: TerminalRpcServiceClient
  readonly terminalManager

  constructor(options: DesktopServiceClientOptions) {
    this.options = options
    this.terminalRpc = new TerminalRpcServiceClient({
      ensureStarted: () => this.ensureStarted(),
      isCurrentChild: (child) => this.process === child,
      onDiagnostic: (message, details) =>
        this.emitDesktopDiagnostic({ severity: 'warning', message, details }),
    })
    this.terminalManager = this.terminalRpc.service
  }

  async dispose() {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Desktop service is shutting down.'))
    }
    this.pendingRequests.clear()
    await this.terminalRpc.dispose()
    this.process?.kill('SIGTERM')
    this.process = null
    this.startPromise = null
  }

  subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
    this.desktopListeners.add(listener)
    return () => this.desktopListeners.delete(listener)
  }

  private emitDesktopDiagnostic(input: {
    severity: 'warning' | 'error'
    message: string
    details?: unknown
  }) {
    const event = createDesktopServiceDiagnosticEvent(input)
    for (const listener of this.desktopListeners) listener(event)
  }

  private handleServiceProcessExit(
    child: ChildProcess,
    ready: boolean,
    code: number | null,
    signal: NodeJS.Signals | null,
    reject: (error: Error) => void,
  ) {
    void this.terminalRpc.dispose()
    this.emitDesktopDiagnostic({
      severity: ready ? 'warning' : 'error',
      message: ready
        ? 'Desktop runtime service exited. It will restart on the next request.'
        : 'Desktop runtime service exited before startup.',
      details: { code, signal },
    })
    this.rejectPending(new Error('Desktop service exited.'))
    if (!ready) {
      this.startPromise = null
      reject(new Error('Desktop service exited before startup.'))
    }
    if (this.process === child) this.process = null
  }

  private clearServiceStartupTimeout(timer: ReturnType<typeof setTimeout> | null) {
    if (timer) clearTimeout(timer)
  }

  async invoke<M extends DesktopServiceModuleName, K extends ServiceMethod<M> & string>(
    moduleName: M,
    method: K,
    args: Parameters<ServiceFunction<M, K>> = [] as unknown as Parameters<ServiceFunction<M, K>>,
  ): Promise<Awaited<ReturnType<ServiceFunction<M, K>>>> {
    return (await this.invokeDynamic(moduleName, method, args)) as Awaited<
      ReturnType<ServiceFunction<M, K>>
    >
  }

  async invokeDynamic(moduleName: DesktopServiceModuleName, method: string, args: unknown[] = []) {
    const child = await this.ensureStarted()
    if (!child.connected) {
      throw new Error('Desktop service IPC channel is disconnected.')
    }

    const id = randomUUID()
    const result = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(
          new Error(
            `Timed out waiting for desktop service method ${moduleName}.${String(method)}.`,
          ),
        )
      }, this.options.requestTimeoutMs ?? defaultRequestTimeoutMs)
      this.pendingRequests.set(id, { resolve, reject, timeout })
    })

    const rejectSendFailure = (error: Error) => {
      const pending = this.pendingRequests.get(id)
      if (!pending) return
      this.pendingRequests.delete(id)
      clearTimeout(pending.timeout)
      pending.reject(error)
    }

    try {
      child.send({ type: 'request', id, module: moduleName, method, args }, (error) => {
        if (error) rejectSendFailure(error)
      })
    } catch (error) {
      rejectSendFailure(error instanceof Error ? error : new Error(String(error)))
    }
    return await result
  }

  private async ensureStarted() {
    if (this.startPromise) return await this.startPromise
    if (this.process && !this.process.killed && this.process.exitCode === null) return this.process

    this.startPromise = (async () => {
      let nodeExecutable: string
      let nodeRuntime: Awaited<ReturnType<typeof prepareServiceNativeRuntime>>
      try {
        nodeExecutable =
          typeof this.options.nodeExecutable === 'function'
            ? await this.options.nodeExecutable()
            : this.options.nodeExecutable
        nodeRuntime = await prepareServiceNativeRuntime({
          nodeExecutable,
          // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
          resourcesPath: this.options.env?.['HOWCODE_ELECTRON_RESOURCES_PATH'],
        })
      } catch (error) {
        this.startPromise = null
        throw error
      }

      return await new Promise<ChildProcess>((resolve, reject) => {
        const child = spawn(nodeExecutable, [this.options.serviceHostPath], {
          cwd: this.options.cwd,
          env: {
            ...process.env,
            ...this.options.env,
            HOWCODE_HANDLE_LOCAL_HOST_REQUESTS: '1',
            HOWCODE_REPO_ROOT: this.options.cwd,
            HOWCODE_SERVICE_NODE_ABI: nodeRuntime.abi,
            HOWCODE_SERVICE_NODE_VERSION: nodeRuntime.version,
          },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        })
        this.process = child

        let ready = false
        let terminalRpcStarting = false
        const startupTimeout = setTimeout(() => {
          this.startPromise = null
          if (this.process === child) this.process = null
          child.kill('SIGTERM')
          reject(new Error('Timed out waiting for desktop service startup.'))
        }, this.options.startupTimeoutMs ?? defaultStartupTimeoutMs)
        startupTimeout.unref?.()

        child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
        child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
        child.on('message', (message: DesktopServiceMessage) => this.handleMessage(message))
        child.once('error', (error) => {
          this.clearServiceStartupTimeout(startupTimeout)
          this.startPromise = null
          if (this.process === child) this.process = null
          this.emitDesktopDiagnostic({
            severity: 'error',
            message: 'Desktop runtime service failed to start.',
            details: error.message,
          })
          reject(error)
        })
        child.once('exit', (code, signal) => {
          this.clearServiceStartupTimeout(startupTimeout)
          this.handleServiceProcessExit(child, ready, code, signal, reject)
        })
        child.on('message', (message: DesktopServiceMessage) => {
          if (message?.type !== 'ready' || ready || terminalRpcStarting) return
          terminalRpcStarting = true
          void this.terminalRpc.connect(child).then(
            () => {
              ready = true
              this.clearServiceStartupTimeout(startupTimeout)
              console.info('Desktop service ready.', message.diagnostics ?? {})
              this.process = child
              this.startPromise = null
              resolve(child)
            },
            (error: unknown) => {
              this.clearServiceStartupTimeout(startupTimeout)
              this.startPromise = null
              if (this.process === child) this.process = null
              child.kill('SIGTERM')
              reject(error instanceof Error ? error : new Error(String(error)))
            },
          )
        })
      })
    })()

    return await this.startPromise
  }

  private rejectPending(error: Error) {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  private handleServiceEvent(message: Extract<DesktopServiceMessage, { type: 'desktop-event' }>) {
    for (const listener of this.desktopListeners) listener(message.event)
  }

  private handleServiceResponse(message: Extract<DesktopServiceMessage, { type: 'response' }>) {
    const pending = this.pendingRequests.get(message.id)
    if (!pending) return
    this.pendingRequests.delete(message.id)
    clearTimeout(pending.timeout)
    if (message.ok) {
      pending.resolve(message.result)
      return
    }

    const error = new Error(message.error ?? 'Desktop service request failed.')
    if (message.stack) error.stack = message.stack
    pending.reject(error)
  }

  private handleMessage(message: DesktopServiceMessage) {
    if (!message || message.type === 'ready') return
    if (message.type === 'desktop-event') {
      this.handleServiceEvent(message)
      return
    }
    if (message.type === 'terminal-rpc-response') {
      this.terminalRpc.write(message.message)
      return
    }

    this.handleServiceResponse(message)
  }
}
