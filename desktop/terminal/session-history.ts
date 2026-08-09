import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { clampHistory } from './session-history.helpers.ts'

export { clampHistory } from './session-history.helpers.ts'

import type { TerminalSessionRecord } from './session-record.ts'

type TranscriptPersistenceRecord = {
  snapshot: Pick<TerminalSessionRecord['snapshot'], 'history'>
  transcriptPath: string
  persistTimer: ReturnType<typeof setTimeout> | null
  persistPromise: Promise<void>
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

function queueTranscriptWrite(record: TranscriptPersistenceRecord) {
  const history = record.snapshot.history
  const write = record.persistPromise
    .catch(() => undefined)
    .then(async () => {
      const transcriptPath = record.transcriptPath
      await mkdir(path.dirname(transcriptPath), { recursive: true })
      await writeFile(transcriptPath, history, 'utf8')
    })
  record.persistPromise = write
  return write
}

export function reportTranscriptWriteFailure(error: unknown) {
  console.warn('Unable to persist terminal transcript.', error)
}

export function persistSession(record: TranscriptPersistenceRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer)
  }

  record.persistTimer = setTimeout(() => {
    record.persistTimer = null
    void queueTranscriptWrite(record).catch(reportTranscriptWriteFailure)
  }, 40)
}

export function flushSession(record: TranscriptPersistenceRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer)
    record.persistTimer = null
  }

  return queueTranscriptWrite(record)
}

export async function moveSessionTranscript(
  record: TranscriptPersistenceRecord,
  nextTranscriptPath: string,
) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer)
    record.persistTimer = null
  }

  const history = record.snapshot.history
  const move = record.persistPromise
    .catch(() => undefined)
    .then(async () => {
      const currentTranscriptPath = record.transcriptPath
      await mkdir(path.dirname(currentTranscriptPath), { recursive: true })
      await writeFile(currentTranscriptPath, history, 'utf8')
      if (currentTranscriptPath === nextTranscriptPath) return
      await mkdir(path.dirname(nextTranscriptPath), { recursive: true })
      await rename(currentTranscriptPath, nextTranscriptPath)
      record.transcriptPath = nextTranscriptPath
    })
  record.persistPromise = move
  await move
}
