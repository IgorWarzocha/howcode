import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'
import type { RuntimeMainToHostMessage } from '../protocol.ts'
import { makeRuntimeHostBroker } from './core.ts'
import type {
  RuntimeHostProcessAdapter,
  RuntimeHostProcessHandlers,
  SpawnedRuntimeHost,
} from './types.ts'
import { brokerError } from './types.ts'

type FakeProcess = {
  readonly id: string
  readonly handlers: RuntimeHostProcessHandlers<FakeProcess>
  running: boolean
}

function makeFakeAdapter(options: {
  readonly sent: Queue.Queue<readonly [FakeProcess, RuntimeMainToHostMessage]>
  readonly spawnCount: Ref.Ref<number>
  readonly terminationCount: Ref.Ref<number>
  readonly autoRespond: boolean
  readonly failFirstSpawn?: boolean | undefined
}) {
  let nextId = 1
  let failNextSpawn = options.failFirstSpawn === true
  const adapter: RuntimeHostProcessAdapter<FakeProcess> = {
    makeId: () => String(nextId++),
    spawn: (_label, handlers) =>
      Effect.gen(function* () {
        yield* Ref.update(options.spawnCount, (count) => count + 1)
        if (failNextSpawn) {
          failNextSpawn = false
          return yield* Effect.fail(brokerError('spawn', new Error('Expected startup failure.')))
        }
        const process: FakeProcess = { id: String(nextId++), handlers, running: true }
        const spawned: SpawnedRuntimeHost<FakeProcess> = { process, ready: Effect.void }
        return spawned
      }),
    send: (process, message) =>
      Effect.gen(function* () {
        yield* Queue.offer(options.sent, [process, message])
        if (options.autoRespond && message.type === 'request') {
          process.handlers.onMessage(process, {
            type: 'response',
            id: message.id,
            ok: true,
            result: { ok: true },
          })
        }
      }),
    terminate: (process) =>
      Effect.gen(function* () {
        if (!process.running) return
        process.running = false
        yield* Ref.update(options.terminationCount, (count) => count + 1)
      }),
    terminateNow: (process) => {
      process.running = false
    },
    isRunning: (process) => process.running,
    installShutdownHandlers: () => Effect.void,
  }
  return adapter
}

describe('Runtime host broker core', () => {
  it('shares one process startup across concurrent requests', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sent = yield* Queue.unbounded<readonly [FakeProcess, RuntimeMainToHostMessage]>()
        const spawnCount = yield* Ref.make(0)
        const terminationCount = yield* Ref.make(0)
        const broker = yield* makeRuntimeHostBroker(
          makeFakeAdapter({ sent, spawnCount, terminationCount, autoRespond: true }),
          { idleTimeout: '5 minutes' },
        )

        const responses = yield* Effect.all(
          [
            broker.invoke('invalidateRuntimeSettings', {}),
            broker.invoke('invalidateRuntimeSettings', {}),
          ],
          { concurrency: 'unbounded' },
        )

        expect(responses).toEqual([{ ok: true }, { ok: true }])
        expect(yield* Ref.get(spawnCount)).toBe(1)
      }).pipe(Effect.scoped),
    )
  })

  it('cleans up a failed startup so the next request can retry', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sent = yield* Queue.unbounded<readonly [FakeProcess, RuntimeMainToHostMessage]>()
        const spawnCount = yield* Ref.make(0)
        const terminationCount = yield* Ref.make(0)
        const broker = yield* makeRuntimeHostBroker(
          makeFakeAdapter({
            sent,
            spawnCount,
            terminationCount,
            autoRespond: true,
            failFirstSpawn: true,
          }),
          { idleTimeout: '5 minutes' },
        )

        const first = yield* Effect.exit(broker.invoke('invalidateRuntimeSettings', {}))
        expect(Exit.isFailure(first)).toBe(true)
        expect(yield* broker.invoke('invalidateRuntimeSettings', {})).toEqual({ ok: true })
        expect(yield* Ref.get(spawnCount)).toBe(2)
      }).pipe(Effect.scoped),
    )
  })

  it('stops an idle thread host with TestClock', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sent = yield* Queue.unbounded<readonly [FakeProcess, RuntimeMainToHostMessage]>()
        const spawnCount = yield* Ref.make(0)
        const terminationCount = yield* Ref.make(0)
        const broker = yield* makeRuntimeHostBroker(
          makeFakeAdapter({ sent, spawnCount, terminationCount, autoRespond: true }),
          { idleTimeout: '5 minutes' },
        )

        yield* broker.invoke('invalidateRuntimeSettings', {
          sessionPath: '/sessions/thread.jsonl',
        })
        expect(yield* Ref.get(terminationCount)).toBe(0)

        yield* TestClock.adjust('5 minutes')
        expect(yield* Ref.get(terminationCount)).toBe(1)
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })

  it('fails pending requests when the broker restarts', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sent = yield* Queue.unbounded<readonly [FakeProcess, RuntimeMainToHostMessage]>()
        const spawnCount = yield* Ref.make(0)
        const terminationCount = yield* Ref.make(0)
        const broker = yield* makeRuntimeHostBroker(
          makeFakeAdapter({ sent, spawnCount, terminationCount, autoRespond: false }),
          { idleTimeout: '5 minutes' },
        )

        const request = yield* broker
          .invoke('invalidateRuntimeSettings', {})
          .pipe(Effect.exit, Effect.forkScoped)
        yield* Queue.take(sent)
        yield* broker.restart

        const exit = yield* Fiber.join(request)
        expect(Exit.isFailure(exit)).toBe(true)
        expect(yield* Ref.get(terminationCount)).toBe(1)
      }).pipe(Effect.scoped),
    )
  })
})
