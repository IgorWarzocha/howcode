import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as Ref from 'effect/Ref'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'
import {
  makeRuntimeRegistry,
  type RuntimeRegistryAdapters,
  RuntimeRegistryError,
} from './live-runtime-registry-core.ts'

type FakeRuntime = {
  readonly id: number
  readonly key: string
  readonly cwd: string
  working: boolean
  pendingDialog: boolean
  branchName: string | null
}

function unusedCreateNew() {
  return Effect.fail(
    new RuntimeRegistryError({ operation: 'createNew', message: 'Not used by this test.' }),
  )
}

describe('Live runtime registry core', () => {
  it('shares one in-flight creation across concurrent callers', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const creationStarted = yield* Deferred.make<void>()
        const allowCreation = yield* Deferred.make<void>()
        const createCount = yield* Ref.make(0)
        const releaseCount = yield* Ref.make(0)
        const expectedRuntime: FakeRuntime = {
          id: 1,
          key: '/sessions/one.jsonl',
          cwd: '/workspace',
          working: false,
          pendingDialog: false,
          branchName: null,
        }
        const adapters: RuntimeRegistryAdapters<FakeRuntime> = {
          createExisting: Effect.fn('FakeRuntime.createExisting')(function* () {
            yield* Ref.update(createCount, (count) => count + 1)
            yield* Deferred.succeed(creationStarted, undefined)
            yield* Deferred.await(allowCreation)
            return expectedRuntime
          }),
          createNew: unusedCreateNew,
          runtimeKey: (runtime) => runtime.key,
          runtimeCwd: (runtime) => runtime.cwd,
          setBranchName: (runtime, branchName) => {
            runtime.branchName = branchName
          },
          isWorking: (runtime) => runtime.working,
          hasPendingDialog: (runtime) => runtime.pendingDialog,
          reload: () => Effect.void,
          abort: () => Effect.void,
          release: () => Ref.update(releaseCount, (count) => count + 1),
        }
        const registry = yield* makeRuntimeRegistry(adapters, { idleTimeout: '15 minutes' })
        const input = {
          runtimeKey: expectedRuntime.key,
          settingsCwd: expectedRuntime.cwd,
          chatGroupId: null,
          suspendDisposal: true,
        }
        const callers = yield* Effect.all(
          [registry.getOrCreate(input), registry.getOrCreate(input)],
          { concurrency: 'unbounded' },
        ).pipe(Effect.forkScoped)

        yield* Deferred.await(creationStarted)
        expect(yield* Ref.get(createCount)).toBe(1)
        yield* Deferred.succeed(allowCreation, undefined)
        const opened = yield* Fiber.join(callers)
        expect(opened).toEqual([expectedRuntime, expectedRuntime])
        expect(yield* registry.getCached(expectedRuntime.key)).toBe(expectedRuntime)

        yield* registry.disposeAll
        expect(yield* Ref.get(releaseCount)).toBe(1)
        expect(yield* registry.getCached(expectedRuntime.key)).toBeNull()
      }).pipe(Effect.scoped),
    )
  })

  it('rechecks busy and dialog-pinned runtimes before releasing them', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const releaseCount = yield* Ref.make(0)
        const expectedRuntime: FakeRuntime = {
          id: 1,
          key: '/sessions/idle.jsonl',
          cwd: '/workspace',
          working: true,
          pendingDialog: false,
          branchName: null,
        }
        const adapters: RuntimeRegistryAdapters<FakeRuntime> = {
          createExisting: () => Effect.succeed(expectedRuntime),
          createNew: unusedCreateNew,
          runtimeKey: (runtime) => runtime.key,
          runtimeCwd: (runtime) => runtime.cwd,
          setBranchName: (runtime, branchName) => {
            runtime.branchName = branchName
          },
          isWorking: (runtime) => runtime.working,
          hasPendingDialog: (runtime) => runtime.pendingDialog,
          reload: () => Effect.void,
          abort: () => Effect.void,
          release: () => Ref.update(releaseCount, (count) => count + 1),
        }
        const registry = yield* makeRuntimeRegistry(adapters, { idleTimeout: '15 minutes' })
        yield* registry.getOrCreate({
          runtimeKey: expectedRuntime.key,
          settingsCwd: expectedRuntime.cwd,
          chatGroupId: null,
          suspendDisposal: true,
        })
        yield* registry.scheduleDisposal(expectedRuntime.key)

        yield* TestClock.adjust('15 minutes')
        expect(yield* Ref.get(releaseCount)).toBe(0)
        expectedRuntime.working = false
        expectedRuntime.pendingDialog = true
        yield* TestClock.adjust('15 minutes')
        expect(yield* Ref.get(releaseCount)).toBe(0)
        expectedRuntime.pendingDialog = false
        yield* TestClock.adjust('15 minutes')
        expect(yield* Ref.get(releaseCount)).toBe(1)
        expect(yield* registry.getCached(expectedRuntime.key)).toBeNull()
      }).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
    )
  })

  it('removes a failed reservation so a later open can retry', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0)
        const expectedRuntime: FakeRuntime = {
          id: 2,
          key: '/sessions/retry.jsonl',
          cwd: '/workspace',
          working: false,
          pendingDialog: false,
          branchName: null,
        }
        const adapters: RuntimeRegistryAdapters<FakeRuntime> = {
          createExisting: Effect.fn('FakeRuntime.createRetrying')(function* () {
            const attempt = yield* Ref.updateAndGet(attempts, (count) => count + 1)
            if (attempt === 1) {
              return yield* Effect.fail(
                new RuntimeRegistryError({ operation: 'createExisting', message: 'Failed once.' }),
              )
            }
            return expectedRuntime
          }),
          createNew: unusedCreateNew,
          runtimeKey: (runtime) => runtime.key,
          runtimeCwd: (runtime) => runtime.cwd,
          setBranchName: (runtime, branchName) => {
            runtime.branchName = branchName
          },
          isWorking: (runtime) => runtime.working,
          hasPendingDialog: (runtime) => runtime.pendingDialog,
          reload: () => Effect.void,
          abort: () => Effect.void,
          release: () => Effect.void,
        }
        const registry = yield* makeRuntimeRegistry(adapters, { idleTimeout: '15 minutes' })
        const input = {
          runtimeKey: expectedRuntime.key,
          settingsCwd: expectedRuntime.cwd,
          chatGroupId: null,
          suspendDisposal: true,
        }

        const first = yield* Effect.exit(registry.getOrCreate(input))
        expect(Exit.isFailure(first)).toBe(true)
        expect(yield* registry.getCached(expectedRuntime.key)).toBeNull()
        expect(yield* registry.getOrCreate(input)).toBe(expectedRuntime)
        expect(yield* Ref.get(attempts)).toBe(2)
      }).pipe(Effect.scoped),
    )
  })

  it('keeps the owned runtime when new-session creation collides on a key', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const createCount = yield* Ref.make(0)
        const releaseCount = yield* Ref.make(0)
        const firstRuntime: FakeRuntime = {
          id: 1,
          key: '/sessions/collision.jsonl',
          cwd: '/workspace',
          working: false,
          pendingDialog: false,
          branchName: null,
        }
        const duplicateRuntime: FakeRuntime = { ...firstRuntime, id: 2 }
        const adapters: RuntimeRegistryAdapters<FakeRuntime> = {
          createExisting: () =>
            Effect.fail(
              new RuntimeRegistryError({
                operation: 'createExisting',
                message: 'Not used by this test.',
              }),
            ),
          createNew: () =>
            Ref.getAndUpdate(createCount, (count) => count + 1).pipe(
              Effect.map((count) => (count === 0 ? firstRuntime : duplicateRuntime)),
            ),
          runtimeKey: (runtime) => runtime.key,
          runtimeCwd: (runtime) => runtime.cwd,
          setBranchName: (runtime, branchName) => {
            runtime.branchName = branchName
          },
          isWorking: (runtime) => runtime.working,
          hasPendingDialog: (runtime) => runtime.pendingDialog,
          reload: () => Effect.void,
          abort: () => Effect.void,
          release: () => Ref.update(releaseCount, (count) => count + 1),
        }
        const registry = yield* makeRuntimeRegistry(adapters, { idleTimeout: '15 minutes' })
        const first = yield* registry.createNew({
          cwd: '/workspace',
          sessionDir: '/workspace',
          branchName: 'first',
          chatGroupId: null,
        })
        const second = yield* registry.createNew({
          cwd: '/workspace',
          sessionDir: '/workspace',
          branchName: 'second',
          chatGroupId: null,
        })

        expect(first).toBe(firstRuntime)
        expect(second).toBe(firstRuntime)
        expect(firstRuntime.branchName).toBe('second')
        expect(yield* Ref.get(releaseCount)).toBe(1)
        expect(yield* registry.getCached(firstRuntime.key)).toBe(firstRuntime)
      }).pipe(Effect.scoped),
    )
  })
})
