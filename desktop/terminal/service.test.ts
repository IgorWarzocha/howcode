import { rmSync } from 'node:fs'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as Layer from 'effect/Layer'
import { describe, expect, it, vi } from 'vitest'
import * as Pty from './pty-service.ts'
import { layer, Service } from './service.ts'
import { getTranscriptPath } from './session-history.ts'
import type { PtyAdapter, PtyExitEvent, PtyProcess } from './types.ts'

class FakePtyProcess implements PtyProcess {
  readonly pid = 42
  killCount = 0
  killSignals: Array<string | undefined> = []
  disposeCount = 0
  private readonly exitCallbacks = new Set<(event: PtyExitEvent) => void>()
  private readonly exitOnlyWhenForced: boolean

  constructor(exitOnlyWhenForced = false) {
    this.exitOnlyWhenForced = exitOnlyWhenForced
  }

  write(data: string) {
    void data
  }

  resize(cols: number, rows: number) {
    void cols
    void rows
  }

  kill(signal?: string) {
    this.killCount += 1
    this.killSignals.push(signal)
    if (this.exitOnlyWhenForced && signal !== 'SIGKILL') return
    for (const callback of this.exitCallbacks) callback({ exitCode: 0, signal: null })
  }

  onData(_callback: (data: string) => void) {
    return () => {
      this.disposeCount += 1
    }
  }

  onExit(callback: (event: PtyExitEvent) => void) {
    this.exitCallbacks.add(callback)
    return () => {
      this.exitCallbacks.delete(callback)
      this.disposeCount += 1
    }
  }
}

describe('Terminal service', () => {
  it('reports failed termination of a PTY that arrives after its record was closed', async () => {
    const process = new FakePtyProcess()
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('Cannot terminate late PTY.')
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const spawned = Promise.withResolvers<PtyProcess>()
    const started = Promise.withResolvers<void>()
    const adapter: PtyAdapter = {
      name: 'failed-late-kill',
      spawn: () => {
        started.resolve()
        return spawned.promise
      },
    }
    const testLayer = layer.pipe(Layer.provide(Layer.succeed(Pty.Service, adapter)))
    let sessionId: string | undefined
    const running = Effect.runPromise(
      Effect.gen(function* () {
        const terminal = yield* Service
        const snapshot = yield* terminal.open({
          projectId: '/tmp/howcode-terminal-late-kill-failure',
          cwd: '/tmp',
          cols: 80,
          rows: 24,
        })
        sessionId = snapshot.sessionId
        const closing = terminal.close({ sessionId: snapshot.sessionId, force: true })
        // close removes the record synchronously before awaiting the in-flight spawn.
        const fiber = yield* Effect.forkChild(closing, { startImmediately: true })
        spawned.resolve(process)
        return yield* Fiber.join(fiber)
      }).pipe(Effect.provide(testLayer)),
    )
    try {
      await started.promise
      await expect(running).rejects.toThrow('Cannot terminate late PTY.')
    } finally {
      warning.mockRestore()
      if (sessionId) rmSync(getTranscriptPath(sessionId), { force: true })
    }
  })

  it('escalates an ordinary close when the PTY does not exit', async () => {
    const process = new FakePtyProcess(true)
    const adapter: PtyAdapter = {
      name: 'stubborn-fake',
      spawn: async () => process,
    }
    const testLayer = layer.pipe(Layer.provide(Layer.succeed(Pty.Service, adapter)))
    const snapshot = await Effect.runPromise(
      Effect.gen(function* () {
        const terminal = yield* Service
        const opened = yield* terminal.open({
          projectId: '/tmp/howcode-effect-terminal-close-test',
          cwd: '/tmp',
          launchMode: 'shell',
          cols: 80,
          rows: 24,
        })
        yield* terminal.close({ sessionId: opened.sessionId })
        return opened
      }).pipe(Effect.provide(testLayer)),
    )

    expect(process.killSignals).toEqual([undefined, 'SIGKILL'])
    rmSync(getTranscriptPath(snapshot.sessionId), { force: true })
  })

  it('waits for an in-flight spawn and kills a late PTY during scope shutdown', async () => {
    const process = new FakePtyProcess(true)
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

    expect(process.killSignals).toEqual([undefined, 'SIGKILL'])
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
