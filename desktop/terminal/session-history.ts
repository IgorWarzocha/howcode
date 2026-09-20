import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type * as Cause from 'effect/Cause'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as FiberHandle from 'effect/FiberHandle'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { clampHistory } from './session-history.helpers.ts'

export { clampHistory } from './session-history.helpers.ts'

type TranscriptPersistenceRecord = {
  snapshot: { history: string }
  transcriptPath: string
  transcriptWriter: TranscriptWriter
}

type TranscriptWrite = {
  operation: () => Promise<void>
  result: Deferred.Deferred<void, unknown>
}

export type TranscriptWriter = Effect.Success<ReturnType<typeof makeTranscriptWriter>>

export function makeTranscriptWriter() {
  return Effect.gen(function* () {
    const writes = yield* Queue.unbounded<TranscriptWrite, Cause.Done>()
    const runDelayed = yield* FiberHandle.makeRuntime<never, never, void>()
    const worker = yield* Stream.fromQueue(writes).pipe(
      Stream.runForEach(({ operation, result }) =>
        Deferred.complete(result, Effect.tryPromise({ try: operation, catch: (error) => error })),
      ),
      Effect.forkScoped,
    )
    // Stop the debounce before ending the queue; drain before the worker is interrupted.
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        runDelayed(Effect.void)
        yield* Queue.end(writes)
        yield* Fiber.join(worker)
      }),
    )

    const enqueue = (operation: () => Promise<void>) => {
      const result = Deferred.makeUnsafe<void, unknown>()
      if (!Queue.offerUnsafe(writes, { operation, result })) {
        return Effect.fail(new Error('Terminal transcript writer is closed.'))
      }
      return Deferred.await(result)
    }
    return {
      enqueue,
      cancelScheduled: () => {
        runDelayed(Effect.void)
      },
      schedule: (operation: () => Promise<void>) => {
        runDelayed(
          Effect.sleep(40).pipe(
            Effect.flatMap(() => enqueue(operation)),
            Effect.catch((error) => Effect.sync(() => reportTranscriptWriteFailure(error))),
          ),
        )
      },
    }
  })
}

function getTranscriptDirectory() {
  return path.join(getDesktopUserDataPath(), 'state', 'terminals')
}

export function nowIso() {
  return new Date().toISOString()
}

export function getTranscriptPath(sessionId: string) {
  return path.join(getTranscriptDirectory(), `${sessionId}.log`)
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

export async function readTranscript(transcriptPath: string) {
  try {
    return clampHistory(await readFile(transcriptPath, 'utf8'))
  } catch (error) {
    if (!isMissingFileError(error)) {
      console.warn('Unable to read terminal transcript.', { transcriptPath, error })
    }
    return ''
  }
}

function transcriptWrite(record: TranscriptPersistenceRecord) {
  const history = record.snapshot.history
  return async () => {
    const transcriptPath = record.transcriptPath
    await mkdir(path.dirname(transcriptPath), { recursive: true })
    await writeFile(transcriptPath, history, 'utf8')
  }
}

export function reportTranscriptWriteFailure(error: unknown) {
  console.warn('Unable to persist terminal transcript.', error)
}

export function persistSession(record: TranscriptPersistenceRecord) {
  record.transcriptWriter.schedule(transcriptWrite(record))
}

export function flushSession(record: TranscriptPersistenceRecord) {
  record.transcriptWriter.cancelScheduled()
  return Effect.runPromise(record.transcriptWriter.enqueue(transcriptWrite(record)))
}

export function clearSessionTranscript(record: TranscriptPersistenceRecord) {
  record.transcriptWriter.cancelScheduled()
  return Effect.runPromise(
    record.transcriptWriter.enqueue(() => rm(record.transcriptPath, { force: true })),
  )
}

export async function moveSessionTranscript(
  record: TranscriptPersistenceRecord,
  nextTranscriptPath: string,
) {
  record.transcriptWriter.cancelScheduled()

  const history = record.snapshot.history
  await Effect.runPromise(
    record.transcriptWriter.enqueue(async () => {
      const currentTranscriptPath = record.transcriptPath
      await mkdir(path.dirname(currentTranscriptPath), { recursive: true })
      await writeFile(currentTranscriptPath, history, 'utf8')
      if (currentTranscriptPath === nextTranscriptPath) return
      await mkdir(path.dirname(nextTranscriptPath), { recursive: true })
      await rename(currentTranscriptPath, nextTranscriptPath)
      record.transcriptPath = nextTranscriptPath
    }),
  )
}
