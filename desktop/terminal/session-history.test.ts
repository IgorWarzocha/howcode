import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { flushSession, moveSessionTranscript } from './session-history'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('terminal transcript persistence', () => {
  it('serializes writes so the newest snapshot remains authoritative', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'howcode-terminal-history-'))
    temporaryDirectories.push(directory)
    const transcriptPath = path.join(directory, 'nested', 'session.log')
    const record = {
      snapshot: { history: 'first' },
      transcriptPath,
      persistTimer: null,
      persistPromise: Promise.resolve(),
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
      persistTimer: null,
      persistPromise: Promise.resolve(),
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
