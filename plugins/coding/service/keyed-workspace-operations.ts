import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Fiber from 'effect/Fiber'
import * as FiberSet from 'effect/FiberSet'
import * as RcMap from 'effect/RcMap'
import * as Scope from 'effect/Scope'
import * as Semaphore from 'effect/Semaphore'

type WorkspaceOperation = 'root-git' | 'file-write' | 'worktree-snapshot'

function makeKeyedWorkspaceOperations() {
  return Effect.gen(function* () {
    const locks = yield* RcMap.make({ lookup: (_key: string) => Semaphore.make(1) })
    const tasks = yield* FiberSet.make<Exit.Exit<unknown, unknown>, never>()
    const run = yield* FiberSet.runtime(tasks)<never>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        yield* FiberSet.awaitEmpty(tasks)
      }),
    )

    return <A>(operation: WorkspaceOperation, key: string, evaluate: () => Promise<A>) => {
      if (closed) return Promise.reject(new Error('Workspace operations are closed.'))
      const task = run(
        Effect.scoped(
          Effect.gen(function* () {
            const lock = yield* RcMap.get(locks, `${operation}\0${key}`)
            return yield* lock.withPermit(
              Effect.tryPromise({ try: evaluate, catch: (error) => error }),
            )
          }),
        ).pipe(Effect.exit, Effect.uninterruptible),
      )
      return Effect.runPromise(Fiber.join(task).pipe(Effect.flatten))
    }
  })
}

const operationScope = Scope.makeUnsafe()
export const runKeyedWorkspaceOperation = Effect.runSync(
  Scope.provide(makeKeyedWorkspaceOperations(), operationScope),
)

export function disposeWorkspaceOperations() {
  return Effect.runPromise(Scope.close(operationScope, Exit.void))
}
