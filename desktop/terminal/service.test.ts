import { rmSync } from 'node:fs'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import { describe, expect, it } from 'vitest'
import * as Pty from './pty-service.ts'
import { layer, Service } from './service.ts'
import { getTranscriptPath } from './session-history.ts'
import type { PtyAdapter, PtyExitEvent, PtyProcess } from './types.ts'

class FakePtyProcess implements PtyProcess {
  readonly pid = 42
  killCount = 0
  disposeCount = 0

  write(data: string) {
    void data
  }

  resize(cols: number, rows: number) {
    void cols
    void rows
  }

  kill() {
    this.killCount += 1
  }

  onData(_callback: (data: string) => void) {
    return () => {
      this.disposeCount += 1
    }
  }

  onExit(_callback: (event: PtyExitEvent) => void) {
    return () => {
      this.disposeCount += 1
    }
  }
}

describe('Terminal service', () => {
  it('owns PTY sessions in the service layer scope', async () => {
    const process = new FakePtyProcess()
    const adapter: PtyAdapter = {
      name: 'fake',
      spawn: async () => process,
    }
    const testLayer = layer.pipe(Layer.provide(Layer.succeed(Pty.Service, adapter)))

    const snapshot = await Effect.runPromise(
      Effect.gen(function* () {
        const terminal = yield* Service
        expect(yield* terminal.list()).toEqual([])
        const subscription = yield* terminal.eventSubscription
        const started = yield* Stream.fromSubscription(subscription).pipe(
          Stream.filter((event) => event.type === 'started'),
          Stream.take(1),
          Stream.runCollect,
          Effect.forkScoped,
        )

        const opened = yield* terminal.open({
          projectId: '/tmp/howcode-effect-terminal-service-test',
          cwd: '/tmp',
          launchMode: 'shell',
          cols: 80,
          rows: 24,
        })
        yield* Fiber.join(started)
        const active = yield* terminal.list()
        expect(active).toHaveLength(1)
        expect(active[0]).toMatchObject({ sessionId: opened.sessionId, status: 'running', pid: 42 })
        return opened
      }).pipe(Effect.scoped, Effect.provide(testLayer)),
    )

    expect(process.killCount).toBe(1)
    expect(process.disposeCount).toBe(2)
    rmSync(getTranscriptPath(snapshot.sessionId), { force: true })
  })

  it('waits for an in-flight spawn and kills a late PTY during scope shutdown', async () => {
    const process = new FakePtyProcess()
    const spawnControl: { resolve: ((process: PtyProcess) => void) | null } = { resolve: null }
    let markSpawnStarted: (() => void) | null = null
    const spawnStarted = new Promise<void>((resolve) => {
      markSpawnStarted = resolve
    })
    const adapter: PtyAdapter = {
      name: 'deferred-fake',
      spawn: () => {
        markSpawnStarted?.()
        return new Promise<PtyProcess>((resolve) => {
          spawnControl.resolve = resolve
        })
      },
    }
    const testLayer = layer.pipe(Layer.provide(Layer.succeed(Pty.Service, adapter)))
    const running = Effect.runPromise(
      Effect.flatMap(Service, (terminal) =>
        terminal.open({
          projectId: '/tmp/howcode-effect-terminal-spawn-race-test',
          cwd: '/tmp',
          launchMode: 'shell',
          cols: 80,
          rows: 24,
        }),
      ).pipe(Effect.provide(testLayer)),
    )

    await spawnStarted
    if (!spawnControl.resolve) throw new Error('Fake PTY spawn did not expose its resolver.')
    spawnControl.resolve(process)
    const snapshot = await running

    expect(process.killCount).toBe(1)
    rmSync(getTranscriptPath(snapshot.sessionId), { force: true })
  })

  it('reserves a session before concurrent opens can spawn duplicate PTYs', async () => {
    const process = new FakePtyProcess()
    let spawnCount = 0
    const adapter: PtyAdapter = {
      name: 'counting-fake',
      spawn: async () => {
        spawnCount += 1
        return process
      },
    }
    const testLayer = layer.pipe(Layer.provide(Layer.succeed(Pty.Service, adapter)))
    const opened = await Effect.runPromise(
      Effect.gen(function* () {
        const terminal = yield* Service
        return yield* Effect.all(
          [
            terminal.open({
              projectId: '/tmp/howcode-effect-terminal-concurrent-open-test',
              cwd: '/tmp',
              launchMode: 'shell',
              cols: 80,
              rows: 24,
            }),
            terminal.open({
              projectId: '/tmp/howcode-effect-terminal-concurrent-open-test',
              cwd: '/tmp',
              launchMode: 'shell',
              cols: 80,
              rows: 24,
            }),
          ],
          { concurrency: 'unbounded' },
        )
      }).pipe(Effect.provide(testLayer)),
    )

    expect(opened[0].sessionId).toBe(opened[1].sessionId)
    expect(spawnCount).toBe(1)
    expect(process.killCount).toBe(1)
    rmSync(getTranscriptPath(opened[0].sessionId), { force: true })
  })
})
