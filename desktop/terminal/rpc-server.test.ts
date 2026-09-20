// biome-ignore-all lint/style/useNamingConvention: Effect RPC wire messages use _tag discriminators.
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Queue from 'effect/Queue'
import { describe, expect, it } from 'vitest'
import * as Pty from './pty-service.ts'
import { createTerminalRpcServer } from './rpc-server.ts'
import { layer, Service } from './service.ts'

describe('terminal IPC protocol', () => {
  it('rejects invalid dimensions before spawning and keeps the connection usable', async () => {
    let spawnCount = 0
    const runtime = ManagedRuntime.make(
      layer.pipe(
        Layer.provide(
          Layer.succeed(Pty.Service, {
            name: 'validation-only',
            spawn: () => {
              spawnCount += 1
              return Promise.reject(new Error('Malformed RPC must not spawn a PTY.'))
            },
          }),
        ),
      ),
    )
    const replies = Effect.runSync(Queue.unbounded<string>())
    try {
      const server = await createTerminalRpcServer(await runtime.runPromise(Service), (reply) => {
        // Child-process IPC transports JSON, not Effect runtime objects.
        Queue.offerUnsafe(replies, JSON.stringify(reply))
      })
      try {
        await server.write({
          _tag: 'Request',
          id: 'invalid-open',
          tag: 'terminal.open',
          headers: [],
          payload: { projectId: '/workspace/project', cols: 0, rows: 24 },
        })
        const rejected: unknown = JSON.parse(await Effect.runPromise(Queue.take(replies)))
        expect(rejected).toMatchObject({
          _tag: 'Exit',
          requestId: 'invalid-open',
          exit: { _tag: 'Failure' },
        })
        expect(spawnCount).toBe(0)

        await server.write({
          _tag: 'Request',
          id: 'after-rejection',
          tag: 'terminal.status',
          headers: [],
          payload: { sessionId: 'no-such-terminal' },
        })
        const status: unknown = JSON.parse(await Effect.runPromise(Queue.take(replies)))
        expect(status).toEqual({
          _tag: 'Exit',
          requestId: 'after-rejection',
          exit: { _tag: 'Success', value: null },
        })
      } finally {
        await server.dispose()
      }
    } finally {
      await runtime.dispose()
    }
  })
})
