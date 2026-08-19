import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'
import { makeDesktopServiceCore } from './core'
import type {
  DesktopServiceClientOptions,
  DesktopServiceProcessAdapter,
  DesktopServiceProcessHandlers,
  DesktopServiceRequestMessage,
  TerminalRpcBridge,
} from './types'

type FakeProcess = {
  readonly id: number
  readonly handlers: DesktopServiceProcessHandlers<FakeProcess>
  running: boolean
}

function makeFixture(
  options: {
    readonly pauseSpawn?: boolean | undefined
    readonly pauseReady?: boolean | undefined
    readonly pauseTerminal?: boolean | undefined
    readonly requestTimeoutMs?: number | undefined
    readonly startupTimeoutMs?: number | undefined
  } = {},
) {
  return Effect.gen(function* () {
    const spawnStarted = yield* Deferred.make<void>()
    const allowSpawn = yield* Deferred.make<void>()
    const terminalStarted = yield* Deferred.make<void>()
    const allowReady = yield* Deferred.make<void>()
    const allowTerminal = yield* Deferred.make<void>()
    const processes = yield* Queue.unbounded<FakeProcess>()
    const sent = yield* Queue.unbounded<readonly [FakeProcess, DesktopServiceRequestMessage]>()
    const spawnCount = yield* Ref.make(0)
    const terminationCount = yield* Ref.make(0)
    const terminalDisposals = yield* Ref.make<readonly number[]>([])
    let nextProcessId = 1
    let nextRequestId = 1

    const adapter: DesktopServiceProcessAdapter<FakeProcess> = {
      makeRequestId: () => String(nextRequestId++),
      spawn: (handlers) =>
        Effect.gen(function* () {
          yield* Ref.update(spawnCount, (count) => count + 1)
          yield* Deferred.succeed(spawnStarted, undefined)
          if (options.pauseSpawn) yield* Deferred.await(allowSpawn)
          const process: FakeProcess = { id: nextProcessId++, handlers, running: true }
          yield* Queue.offer(processes, process)
          return {
            process,
            ready: options.pauseReady
              ? Deferred.await(allowReady).pipe(Effect.as({ source: 'test' }))
              : Effect.succeed({ source: 'test' }),
          }
        }),
      send: (process, message) => Queue.offer(sent, [process, message]),
      terminate: (process) =>
        Effect.gen(function* () {
          if (!process.running) return
          process.running = false
          yield* Ref.update(terminationCount, (count) => count + 1)
        }),
      isRunning: (process) => process.running,
    }

    const terminal: TerminalRpcBridge<FakeProcess> = {
      connect: () =>
        Effect.gen(function* () {
          yield* Deferred.succeed(terminalStarted, undefined)
          if (options.pauseTerminal) yield* Deferred.await(allowTerminal)
        }),
      dispose: (process) => Ref.update(terminalDisposals, (ids) => [...ids, process.id]),
      write: () => undefined,
    }

    const client: DesktopServiceClientOptions = {
      nodeExecutable: '/fake/node',
      serviceHostPath: '/fake/service-host.mjs',
      cwd: '/workspace',
      startupTimeoutMs: options.startupTimeoutMs ?? 10_000,
      requestTimeoutMs: options.requestTimeoutMs ?? 60_000,
    }
    const core = yield* makeDesktopServiceCore({ adapter, client, terminal })
    return {
      allowReady,
      allowSpawn,
      allowTerminal,
      core,
      processes,
      sent,
      spawnCount,
      spawnStarted,
      terminalDisposals,
      terminalStarted,
      terminationCount,
    }
  })
}

describe('Desktop service core', () => {
  it('shares startup and waits for terminal RPC readiness', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ pauseReady: true, pauseTerminal: true })
        const callers = yield* Effect.all(
          [fixture.core.ensureStarted, fixture.core.ensureStarted],
          { concurrency: 'unbounded' },
        ).pipe(Effect.forkScoped)
        const process = yield* Queue.take(fixture.processes)

        expect(yield* Ref.get(fixture.spawnCount)).toBe(1)
        yield* Deferred.succeed(fixture.allowReady, undefined)
        yield* Deferred.await(fixture.terminalStarted)
        expect(callers.pollUnsafe()).toBeUndefined()

        yield* Deferred.succeed(fixture.allowTerminal, undefined)
        expect(yield* Fiber.join(callers)).toEqual([process, process])
      }).pipe(Effect.scoped),
    )
  })

  it('cannot resurrect a child when disposed during preparation', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ pauseSpawn: true })
        const first = yield* fixture.core.ensureStarted.pipe(Effect.exit, Effect.forkScoped)
        yield* Deferred.await(fixture.spawnStarted)

        yield* fixture.core.dispose
        yield* Deferred.succeed(fixture.allowSpawn, undefined)
        expect(Exit.isFailure(yield* Fiber.join(first))).toBe(true)

        const second = yield* fixture.core.ensureStarted
        expect(second.running).toBe(true)
        expect(yield* fixture.core.currentProcess).toBe(second)
        expect(yield* Ref.get(fixture.spawnCount)).toBe(2)
      }).pipe(Effect.scoped),
    )
  })

  it('cleans up a timed-out startup before retrying', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ pauseReady: true, startupTimeoutMs: 1_000 })
        const first = yield* fixture.core.ensureStarted.pipe(Effect.exit, Effect.forkScoped)
        yield* Queue.take(fixture.processes)

        yield* TestClock.adjust('1 second')
        expect(Exit.isFailure(yield* Fiber.join(first))).toBe(true)
        yield* fixture.core.dispose
        expect(yield* Ref.get(fixture.terminationCount)).toBe(1)

        yield* Deferred.succeed(fixture.allowReady, undefined)
        expect((yield* fixture.core.ensureStarted).running).toBe(true)
        expect(yield* Ref.get(fixture.spawnCount)).toBe(2)
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })

  it('ignores a stale child exit after replacement', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture()
        const first = yield* fixture.core.ensureStarted
        yield* fixture.core.dispose
        const second = yield* fixture.core.ensureStarted

        first.handlers.onExit(first, 0, null)
        const request = yield* fixture.core
          .invoke('piThreads', 'loadComposerState', [])
          .pipe(Effect.forkScoped)
        const [sentTo, message] = yield* Queue.take(fixture.sent)
        expect(sentTo).toBe(second)
        second.handlers.onMessage(second, {
          type: 'response',
          id: message.id,
          ok: true,
          result: 'still-running',
        })
        expect(yield* Fiber.join(request)).toBe('still-running')
      }).pipe(Effect.scoped),
    )
  })

  it('rejects old pending requests when replacing an already-dead child', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture()
        const firstProcess = yield* fixture.core.ensureStarted
        const pending = yield* fixture.core
          .invoke('piThreads', 'loadComposerState', [])
          .pipe(Effect.exit, Effect.forkScoped)
        yield* Queue.take(fixture.sent)

        firstProcess.running = false
        const replacement = yield* fixture.core.ensureStarted
        expect(replacement).not.toBe(firstProcess)
        expect(Exit.isFailure(yield* Fiber.join(pending))).toBe(true)
      }).pipe(Effect.scoped),
    )
  })

  it('times out a request and ignores its late response', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ requestTimeoutMs: 1_000 })
        const process = yield* fixture.core.ensureStarted
        const first = yield* fixture.core
          .invoke('piThreads', 'loadComposerState', [])
          .pipe(Effect.exit, Effect.forkScoped)
        const [, firstMessage] = yield* Queue.take(fixture.sent)

        yield* TestClock.adjust('1 second')
        expect(Exit.isFailure(yield* Fiber.join(first))).toBe(true)
        process.handlers.onMessage(process, {
          type: 'response',
          id: firstMessage.id,
          ok: true,
          result: 'late',
        })

        const second = yield* fixture.core
          .invoke('piThreads', 'loadComposerState', [])
          .pipe(Effect.forkScoped)
        const [, secondMessage] = yield* Queue.take(fixture.sent)
        process.handlers.onMessage(process, {
          type: 'response',
          id: secondMessage.id,
          ok: true,
          result: 'current',
        })
        expect(yield* Fiber.join(second)).toBe('current')
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })
})
