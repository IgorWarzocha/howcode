import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearSessionTranscript,
  flushSession,
  makeTranscriptWriter,
  moveSessionTranscript,
} from './session-history'

const temporaryDirectories: string[] = []
const scopes: Scope.Closeable[] = []

function writer() {
  const scope = Scope.makeUnsafe()
  scopes.push(scope)
  return Effect.runSync(Scope.provide(makeTranscriptWriter(), scope))
}

afterEach(async () => {
  await Promise.all(
    scopes.splice(0).map((scope) => Effect.runPromise(Scope.close(scope, Exit.void))),
  )
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('terminal transcript persistence', () => {
  it('drains accepted writes on close and keeps processing after a failed write', async () => {
    const scope = Scope.makeUnsafe()
    const persistence = Effect.runSync(Scope.provide(makeTranscriptWriter(), scope))
    const gate = Promise.withResolvers<void>()
    const completed: string[] = []
    const first = Effect.runPromise(
      persistence.enqueue(async () => {
        await gate.promise
        throw new Error('disk unavailable')
      }),
    )
    const failure = expect(first).rejects.toThrow('disk unavailable')
    const second = Effect.runPromise(
      persistence.enqueue(async () => {
        completed.push('second')
      }),
    )
    let closed = false
    const closing = Effect.runPromise(Scope.close(scope, Exit.void)).then(() => {
      closed = true
    })
    await Promise.resolve()
    expect(closed).toBe(false)
    gate.resolve()
    await Promise.all([failure, second, closing])
    expect(completed).toEqual(['second'])
    await expect(Effect.runPromise(persistence.enqueue(async () => undefined))).rejects.toThrow(
      'closed',
    )
  })

  it('clears after earlier writes instead of letting an in-flight write resurrect history', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'howcode-terminal-history-'))
    temporaryDirectories.push(directory)
    const record = {
      snapshot: { history: 'old' },
      transcriptPath: path.join(directory, 'session.log'),
      transcriptWriter: writer(),
    }
    const write = flushSession(record)
    const clear = clearSessionTranscript(record)
    await Promise.all([write, clear])
    await expect(readFile(record.transcriptPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('serializes writes so the newest snapshot remains authoritative', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'howcode-terminal-history-'))
    temporaryDirectories.push(directory)
    const transcriptPath = path.join(directory, 'nested', 'session.log')
    const record = {
      snapshot: { history: 'first' },
      transcriptPath,
      transcriptWriter: writer(),
    }

    const firstWrite = flushSession(record)
    record.snapshot.history = 'second'
    const secondWrite = flushSession(record)
    await Promise.all([firstWrite, secondWrite])

    await expect(readFile(transcriptPath, 'utf8')).resolves.toBe('second')
  })

  it('keeps writes queued during a transcript move on the new path', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'howcode-terminal-history-'))
    temporaryDirectories.push(directory)
    const oldPath = path.join(directory, 'old.log')
    const newPath = path.join(directory, 'nested', 'new.log')
    const record = {
      snapshot: { history: 'first' },
      transcriptPath: oldPath,
      transcriptWriter: writer(),
    }

    const firstWrite = flushSession(record)
    record.snapshot.history = 'second'
    const move = moveSessionTranscript(record, newPath)
    record.snapshot.history = 'third'
    const finalWrite = flushSession(record)
    await Promise.all([firstWrite, move, finalWrite])

    expect(record.transcriptPath).toBe(newPath)
    await expect(readFile(newPath, 'utf8')).resolves.toBe('third')
  })
})
