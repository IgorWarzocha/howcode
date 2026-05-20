import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { DesktopEvent } from '../../../../shared/desktop-contracts'
import { getDesktopWorkingDirectory } from '../../../../shared/desktop-working-directory'
import type { TerminalEvent } from '../../../../shared/terminal-contracts'
import { getDesktopBuildDirectory } from './app-paths'
import type {
  DesktopRuntimeModules,
  PiSkillsModule,
  PiThreadsModule,
  SkillCreatorModule,
  TerminalManagerModule,
} from './desktop-runtime-contracts'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

type ServiceMessage =
  | { type: 'ready'; diagnostics?: Record<string, unknown> }
  | { type: 'response'; id: string; ok: boolean; result?: unknown; error?: string; stack?: string }
  | { type: 'desktop-event'; event: DesktopEvent }
  | { type: 'terminal-event'; event: TerminalEvent }

const requestTimeoutMs = 60_000

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getNodeExecutable() {
  return getProcessEnvironmentVariable('HOWCODE_NODE_PATH')?.trim() || 'node'
}

function getServiceHostPath() {
  return path.join(getDesktopBuildDirectory(), 'service-host.mjs')
}

export class DesktopServiceProxy {
  private process: ChildProcess | null = null
  private startPromise: Promise<ChildProcess> | null = null
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly desktopListeners = new Set<(event: DesktopEvent) => void>()
  private readonly terminalListeners = new Set<(event: TerminalEvent) => void>()

  async dispose() {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Desktop service is shutting down.'))
    }
    this.pendingRequests.clear()
    this.process?.kill('SIGTERM')
    this.process = null
    this.startPromise = null
  }

  subscribeDesktopEvents(listener: (event: DesktopEvent) => void) {
    this.desktopListeners.add(listener)
    return () => this.desktopListeners.delete(listener)
  }

  subscribeTerminalEvents(listener: (event: TerminalEvent) => void) {
    this.terminalListeners.add(listener)
    return () => this.terminalListeners.delete(listener)
  }

  async invoke(moduleName: string, method: string, args: unknown[] = []) {
    const child = await this.ensureStarted()
    const id = randomUUID()
    const result = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Timed out waiting for desktop service method ${moduleName}.${method}.`))
      }, requestTimeoutMs)
      this.pendingRequests.set(id, { resolve, reject, timeout })
    })

    child.send({ type: 'request', id, module: moduleName, method, args })
    return await result
  }

  private async ensureStarted() {
    if (this.process && !this.process.killed && this.process.exitCode === null) return this.process
    if (this.startPromise) return await this.startPromise

    this.startPromise = new Promise<ChildProcess>((resolve, reject) => {
      const child = spawn(getNodeExecutable(), [getServiceHostPath()], {
        cwd: getDesktopWorkingDirectory(),
        env: {
          ...process.env,
          HOWCODE_HANDLE_MAIN_REQUESTS_IN_HOST: '1',
          HOWCODE_REPO_ROOT: getDesktopWorkingDirectory(),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })

      let ready = false
      child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
      child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
      child.on('message', (message: ServiceMessage) => this.handleMessage(message))
      child.once('error', reject)
      child.once('exit', (_code, _signal) => {
        this.rejectPending(new Error('Desktop service exited.'))
        if (this.process === child) this.process = null
      })
      child.on('message', (message: ServiceMessage) => {
        if (message?.type === 'ready' && !ready) {
          ready = true
          console.info('Desktop service ready.', message.diagnostics ?? {})
          this.process = child
          this.startPromise = null
          resolve(child)
        }
      })
    })

    return await this.startPromise
  }

  private rejectPending(error: Error) {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  private handleServiceEvent(
    message: Extract<ServiceMessage, { type: 'desktop-event' | 'terminal-event' }>,
  ) {
    if (message.type === 'desktop-event') {
      for (const listener of this.desktopListeners) listener(message.event)
      return
    }

    for (const listener of this.terminalListeners) listener(message.event)
  }

  private handleServiceResponse(message: Extract<ServiceMessage, { type: 'response' }>) {
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

  private handleMessage(message: ServiceMessage) {
    if (!message || message.type === 'ready') return
    if (message.type === 'desktop-event' || message.type === 'terminal-event') {
      this.handleServiceEvent(message)
      return
    }

    this.handleServiceResponse(message)
  }
}

function proxyModule<T extends Record<string, unknown>>(
  service: DesktopServiceProxy,
  moduleName: string,
) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'subscribeDesktopEvents')
          return service.subscribeDesktopEvents.bind(service)
        if (property === 'subscribeTerminalEvents')
          return service.subscribeTerminalEvents.bind(service)
        if (property === 'disposeDesktopRuntime') return service.dispose.bind(service)
        if (property === 'closeAllTerminals') return service.dispose.bind(service)
        return (...args: unknown[]) => service.invoke(moduleName, String(property), args)
      },
    },
  ) as T
}

export function createDesktopServiceRuntime(): DesktopRuntimeModules {
  const service = new DesktopServiceProxy()
  return {
    piThreads: proxyModule<PiThreadsModule>(service, 'piThreads'),
    piSkills: proxyModule<PiSkillsModule>(service, 'piSkills'),
    skillCreator: proxyModule<SkillCreatorModule>(service, 'skillCreator'),
    terminalManager: proxyModule<TerminalManagerModule>(service, 'terminalManager'),
  }
}
