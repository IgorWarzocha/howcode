import type { ChildProcess } from 'node:child_process'
import * as Effect from 'effect/Effect'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Stream from 'effect/Stream'
import type { DesktopEvent } from '../../shared/desktop-contracts'
import { makeLayer, Service } from './desktop-service/service'
import type {
  DesktopServiceApi,
  DesktopServiceClientOptions,
  DesktopServiceModuleName,
} from './desktop-service/types'
import { TerminalRpcServiceClient } from './terminal-rpc-client'

export type {
  DesktopServiceApi,
  DesktopServiceClientOptions,
  DesktopServiceMessage,
  DesktopServiceModuleName,
} from './desktop-service/types'

type ServiceMethod<M extends DesktopServiceModuleName> = {
  [K in keyof DesktopServiceApi[M]]: DesktopServiceApi[M][K] extends (...args: never[]) => unknown
    ? K
    : never
}[keyof DesktopServiceApi[M]]

type ServiceFunction<M extends DesktopServiceModuleName, K extends ServiceMethod<M>> = Extract<
  DesktopServiceApi[M][K],
  (...args: never[]) => unknown
>

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
  private readonly desktopListeners = new Set<(event: DesktopEvent) => void>()
  private readonly runtime: ManagedRuntime.ManagedRuntime<Service, never>
  private readonly terminalRpc: TerminalRpcServiceClient
  readonly terminalManager

  constructor(options: DesktopServiceClientOptions) {
    this.terminalRpc = new TerminalRpcServiceClient({
      ensureStarted: () => this.ensureStarted(),
      onDiagnostic: (message, details) =>
        this.emitDesktopDiagnostic({ severity: 'warning', message, details }),
    })
    this.terminalManager = this.terminalRpc.service
    this.runtime = ManagedRuntime.make(makeLayer(options, this.terminalRpc))
    this.runtime.runFork(
      Effect.flatMap(Service, (service) =>
        service.events.pipe(
          Stream.runForEach((event) => Effect.sync(() => this.emitDesktopEvent(event))),
        ),
      ),
    )
  }

  private run<A, E>(evaluate: (service: Service['Service']) => Effect.Effect<A, E>) {
    return this.runtime.runPromise(Effect.flatMap(Service, evaluate))
  }

  private ensureStarted(): Promise<ChildProcess> {
    return this.run((service) => service.ensureStarted)
  }

  dispose() {
    return this.run((service) => service.dispose)
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
    this.emitDesktopEvent(createDesktopServiceDiagnosticEvent(input))
  }

  private emitDesktopEvent(event: DesktopEvent) {
    for (const listener of this.desktopListeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('Desktop service event listener failed.', error)
      }
    }
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

  invokeDynamic(moduleName: DesktopServiceModuleName, method: string, args: unknown[] = []) {
    return this.run((service) => service.invoke(moduleName, method, args))
  }
}
