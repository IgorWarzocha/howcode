import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { normalizeThreadTitle } from '../../shared/pi-message-mapper.ts'
import { invokeRuntimeHost } from '../runtime-host/client-bridge.ts'
import { mapWithConcurrency } from './map-with-concurrency.ts'

export type SessionSummary = {
  id: string
  name?: string | undefined
  firstMessage?: string | undefined
  modified: Date
  path: string
  cwd?: string | undefined
}

type SessionFileEntry = {
  type?: string | undefined
  id?: string | undefined
  timestamp?: string | undefined
  cwd?: string | undefined
  message?: {
    role?: string | undefined
    timestamp?: number | undefined
    content?: string | undefined | Array<{ type?: string | undefined; text?: string | undefined }>
  }
  name?: string | undefined
}

type SessionSummaryReadResult = {
  summary: SessionSummary | null
  failed: boolean
}

type SessionIndexReadResult = {
  sessions: SessionSummary[]
  partialFailure: boolean
}

const SESSION_SUMMARY_READ_CONCURRENCY = 12

function isNodeErrorWithCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function readDirectoryIfPresent(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true })
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return []
    }

    throw error
  }
}

function getMessageText(entry: SessionFileEntry) {
  const content = entry.message?.content
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    let text = ''
    for (const block of content) {
      if (block.type !== 'text' || typeof block.text !== 'string') {
        continue
      }

      text += text ? ` ${block.text}` : block.text
    }

    return text
  }

  return ''
}

function getEntryTimestampMs(entry: SessionFileEntry) {
  if (typeof entry.message?.timestamp === 'number') {
    return entry.message.timestamp
  }

  if (typeof entry.timestamp !== 'string') {
    return null
  }

  const timestampMs = Date.parse(entry.timestamp)
  return Number.isNaN(timestampMs) ? null : timestampMs
}

function getSessionModifiedDate(
  header: SessionFileEntry,
  lastActivityTimeMs: number | null,
  fileModified: Date,
) {
  if (lastActivityTimeMs !== null) {
    return new Date(lastActivityTimeMs)
  }

  const headerTimestampMs =
    typeof header.timestamp === 'string' ? Date.parse(header.timestamp) : Number.NaN
  return Number.isNaN(headerTimestampMs) ? fileModified : new Date(headerTimestampMs)
}

type ParsedSessionSummaryFile = {
  header?: SessionFileEntry | undefined
  firstMessage?: string | undefined
  name?: string | undefined
  lastActivityTimeMs: number | null
}

function parseSessionFileEntry(line: string) {
  if (!line.trim()) return null
  try {
    return JSON.parse(line) as SessionFileEntry
  } catch {
    return null
  }
}

function applySessionFileEntry(
  current: ParsedSessionSummaryFile,
  entry: SessionFileEntry,
): ParsedSessionSummaryFile {
  const next = { ...current, header: current.header ?? entry }
  if (entry.type === 'session_info') {
    next.name = entry.name?.trim() || undefined
  }

  if (!next.firstMessage && entry.type === 'message' && entry.message?.role === 'user') {
    next.firstMessage = getMessageText(entry) || undefined
  }

  if (
    entry.type === 'message' &&
    (entry.message?.role === 'user' || entry.message?.role === 'assistant')
  ) {
    const entryTimestampMs = getEntryTimestampMs(entry)
    next.lastActivityTimeMs =
      entryTimestampMs === null
        ? next.lastActivityTimeMs
        : Math.max(next.lastActivityTimeMs ?? 0, entryTimestampMs)
  }

  return next
}

async function readSessionSummaryFile(filePath: string) {
  let result: ParsedSessionSummaryFile = { lastActivityTimeMs: null }
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of lines) {
    const entry = parseSessionFileEntry(line)
    if (entry) result = applySessionFileEntry(result, entry)
  }

  return result
}

async function readSessionSummary(filePath: string): Promise<SessionSummaryReadResult> {
  let fileStat: Awaited<ReturnType<typeof stat>>
  try {
    fileStat = await stat(filePath)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return { summary: null, failed: false }
    }

    console.warn(`Failed to stat session file while refreshing shell index: ${filePath}`, error)
    return { summary: null, failed: true }
  }

  let parsedFile: ParsedSessionSummaryFile

  try {
    parsedFile = await readSessionSummaryFile(filePath)
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return { summary: null, failed: false }
    }

    console.warn(`Failed to read session file while refreshing shell index: ${filePath}`, error)
    return { summary: null, failed: true }
  }

  const { firstMessage, header, lastActivityTimeMs, name } = parsedFile

  if (!header || header.type !== 'session' || typeof header.id !== 'string') {
    console.warn(`Invalid session header while refreshing shell index: ${filePath}`)
    return { summary: null, failed: true }
  }

  return {
    summary: {
      id: header.id,
      cwd: typeof header.cwd === 'string' ? header.cwd : undefined,
      path: filePath,
      name,
      firstMessage,
      modified: getSessionModifiedDate(header, lastActivityTimeMs, fileStat.mtime),
    },
    failed: false,
  }
}

export function mapSessionSummaryToRecord(cwd: string, session: SessionSummary) {
  return {
    id: session.id,
    cwd: session.cwd || cwd,
    sessionPath: session.path,
    title: normalizeThreadTitle(session.firstMessage || session.name),
    lastModifiedMs: session.modified.getTime(),
  }
}

export async function listAllSessionsStrict(): Promise<SessionIndexReadResult> {
  const { agentDir } = await invokeRuntimeHost('getPiSessionStorage', {})
  const sessionsDir = path.join(agentDir, 'sessions')
  const sessionDirectories = (await readDirectoryIfPresent(sessionsDir)).filter((entry) =>
    entry.isDirectory(),
  )

  const sessionFilePaths: string[] = []

  const sessionDirectoryResults = await Promise.all(
    sessionDirectories.map(async (sessionDirectory) => {
      const sessionDirectoryPath = path.join(sessionsDir, sessionDirectory.name)

      let sessionFiles: Awaited<ReturnType<typeof readDirectoryIfPresent>>
      try {
        sessionFiles = await readDirectoryIfPresent(sessionDirectoryPath)
      } catch (error) {
        console.warn(
          `Failed to read session directory while refreshing shell index: ${sessionDirectoryPath}`,
          error,
        )
        return { filePaths: [], failed: true }
      }

      return {
        filePaths: sessionFiles
          .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
          .map((entry) => path.join(sessionDirectoryPath, entry.name)),
        failed: false,
      }
    }),
  )

  let partialFailure = sessionDirectoryResults.some((result) => result.failed)
  for (const result of sessionDirectoryResults) {
    sessionFilePaths.push(...result.filePaths)
  }

  const sessionResults = await mapWithConcurrency(
    sessionFilePaths,
    SESSION_SUMMARY_READ_CONCURRENCY,
    readSessionSummary,
  )
  const sessions = sessionResults
    .map((result) => result.summary)
    .filter((session): session is SessionSummary => session !== null)
  partialFailure ||= sessionResults.some((result) => result.failed)
  sessions.sort((left, right) => right.modified.getTime() - left.modified.getTime())
  return { sessions, partialFailure }
}
