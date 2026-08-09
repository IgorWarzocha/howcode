import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Stream from 'effect/Stream'
import type { DesktopEvent } from '../../shared/desktop-contracts.ts'
import { layer, Service } from './broker/service.ts'
import type {
  RuntimeHostRequestMap,
  RuntimeHostRequestName,
  RuntimeHostResponseMap,
} from './protocol.ts'

const runtime = ManagedRuntime.make(layer)

function run<A, E>(evaluate: (service: Service['Service']) => Effect.Effect<A, E>) {
  return runtime.runPromise(Effect.flatMap(Service, evaluate))
}

export function shutdownRuntimeHosts() {
  return run((service) => service.shutdown)
}

export function invokeRuntimeHost<TName extends RuntimeHostRequestName>(
  name: TName,
  payload: RuntimeHostRequestMap[TName],
): Promise<RuntimeHostResponseMap[TName]> {
  return run((service) => service.invoke(name, payload))
}

export function invalidateRuntimeHostSettings(
  request: {
    sessionPath?: string | null | undefined
    projectPath?: string | null | undefined
  } = {},
) {
  return run((service) => service.invalidateSettings(request))
}

export function disposeRuntimeHostsForWorkspace(request: {
  projectPath: string
  sessionPaths: string[]
}) {
  return run((service) => service.disposeWorkspace(request))
}

export function restartRuntimeHostsForEnvironmentChange() {
  return run((service) => service.restart)
}

export function subscribeRuntimeHostEvents(listener: (event: DesktopEvent) => void) {
  const fiber = runtime.runFork(
    Effect.gen(function* () {
      const service = yield* Service
      const consumeEvents = service.events.pipe(
        Stream.runForEach((event) => Effect.sync(() => listener(event))),
      )
      const keepStartingServiceHost = service.ensureServiceHost.pipe(
        Effect.catch((error) =>
          Effect.sync(() =>
            console.error('Failed to start Pi runtime service host for desktop events.', error),
          ),
        ),
        Effect.andThen(Effect.never),
      )
      yield* Effect.all([consumeEvents, keepStartingServiceHost], {
        concurrency: 'unbounded',
        discard: true,
      })
    }),
  )
  return () => {
    runtime.runFork(Fiber.interrupt(fiber))
  }
}
