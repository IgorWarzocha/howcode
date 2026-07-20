import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Stream from 'effect/Stream'
import type { TerminalService } from '../../shared/desktop-service-contracts.ts'
import type { TerminalEvent } from '../../shared/terminal-contracts.ts'
import { liveLayer, Service } from './service.ts'

const runtime = ManagedRuntime.make(liveLayer)

function run<A, E>(evaluate: (service: Service['Service']) => Effect.Effect<A, E>) {
  return runtime.runPromise(Effect.flatMap(Service, evaluate))
}

export const closeAllTerminals: TerminalService['closeAllTerminals'] = () =>
  run((service) => service.closeAll())

export const closeTerminal: TerminalService['closeTerminal'] = (request) =>
  run((service) => service.close(request))

export const getTerminalStatus: TerminalService['getTerminalStatus'] = (sessionId) =>
  run((service) => service.status(sessionId))

export const listTerminals: TerminalService['listTerminals'] = () =>
  run((service) => service.list())

export const openTerminal: TerminalService['openTerminal'] = (request) =>
  run((service) => service.open(request))

export const resizeTerminal: TerminalService['resizeTerminal'] = (sessionId, cols, rows) =>
  run((service) => service.resize(sessionId, cols, rows))

export const statSessionFile: TerminalService['statSessionFile'] = (sessionId) =>
  run((service) => service.statSessionFile(sessionId))

export const writeTerminal: TerminalService['writeTerminal'] = (sessionId, data) =>
  run((service) => service.write(sessionId, data))

export function subscribeTerminalEvents(listener: (event: TerminalEvent) => void) {
  const fiber = runtime.runFork(
    Effect.flatMap(Service, (service) =>
      service.events.pipe(Stream.runForEach((event) => Effect.sync(() => listener(event)))),
    ),
  )
  return () => {
    runtime.runFork(Fiber.interrupt(fiber))
  }
}

export function getTerminalEffectService() {
  return run((service) => Effect.succeed(service))
}

export function disposeTerminalRuntime() {
  return runtime.dispose()
}
