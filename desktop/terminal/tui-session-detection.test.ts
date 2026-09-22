import * as Effect from 'effect/Effect'
import * as FiberHandle from 'effect/FiberHandle'
import * as Scope from 'effect/Scope'
import { TestClock } from 'effect/testing'
import { expect, it, vi } from 'vitest'
import { publishExternalThreadUpdate } from '../pi-threads/external-thread-publisher.ts'
import { listAllSessionsStrict } from '../pi-threads/session-index.ts'
import { makeTranscriptWriter } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import { makeTerminalSessionStore } from './session-store.ts'
import {
  createTuiSessionDetection,
  scheduleTuiSessionDetection,
  stopTuiSessionDetection,
} from './tui-session-detection.ts'

vi.mock('../pi-threads/session-index.ts', () => ({ listAllSessionsStrict: vi.fn() }))
vi.mock('../pi-threads/thread-loader.ts', () => ({ loadThreadSnapshot: vi.fn() }))
vi.mock('../pi-threads/external-thread-publisher.ts', () => ({
  publishExternalThreadUpdate: vi.fn(),
}))

it('debounces prompt detection, does not overlap scans, and drains the active scan when stopped', async () => {
  const scan = Promise.withResolvers<Awaited<ReturnType<typeof listAllSessionsStrict>>>()
  vi.mocked(listAllSessionsStrict).mockReturnValue(scan.promise)
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const store = yield* makeTerminalSessionStore
        const request = {
          projectId: '/project',
          launchMode: 'pi-session' as const,
          cols: 80,
          rows: 24,
        }
        const record: TerminalSessionRecord = {
          scope: yield* Scope.fork(yield* Scope.Scope),
          snapshot: {
            ...request,
            sessionId: 'test',
            sessionPath: null,
            cwd: '/project',
            status: 'starting',
            pid: null,
            history: '',
            hasVisibleContent: false,
            exitCode: null,
            exitSignal: null,
            updatedAt: '',
          },
          process: null,
          restart: yield* FiberHandle.make<void, never>(),
          transcriptPath: '/unused',
          inputBuffer: '',
          suppressOutputVisibilityUntilInput: false,
          transcriptWriter: yield* makeTranscriptWriter(),
          tuiSessionDetection: yield* createTuiSessionDetection(request),
          cleanup: [],
          deleteHistoryOnClose: false,
          forceKillOnClose: false,
        }
        store.set('test', record)
        scheduleTuiSessionDetection(store, record, 'retry')
        yield* TestClock.adjust(100)
        scheduleTuiSessionDetection(store, record)
        yield* TestClock.adjust(179)
        expect(listAllSessionsStrict).not.toHaveBeenCalled()
        yield* TestClock.adjust(1)
        expect(listAllSessionsStrict).toHaveBeenCalledTimes(1)
        scheduleTuiSessionDetection(store, record)
        yield* TestClock.adjust(180)
        expect(listAllSessionsStrict).toHaveBeenCalledTimes(1)
        let stopped = false
        const stopping = stopTuiSessionDetection(record).then(() => {
          stopped = true
        })
        yield* Effect.yieldNow
        expect(stopped).toBe(false)
        scan.resolve({ sessions: [], partialFailure: false })
        yield* Effect.promise(() => stopping)
        yield* TestClock.adjust(1000)
        expect(listAllSessionsStrict).toHaveBeenCalledTimes(1)
        expect(publishExternalThreadUpdate).not.toHaveBeenCalled()
      }),
    ).pipe(Effect.provide(TestClock.layer())),
  )
})
