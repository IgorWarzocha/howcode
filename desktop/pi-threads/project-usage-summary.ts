import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import type {
  ProjectUsageSessionSummary,
  ProjectUsageSummary,
} from '../../shared/desktop-contracts.ts'
import {
  getProjectStoredUsageTotals,
  listArchivedProjectThreads,
  listProjectThreads,
} from '../thread-state-db.ts'
import { mapWithConcurrency } from './map-with-concurrency.ts'
import { decodeSessionFileLine } from './session-entry-schema.ts'

const PROJECT_USAGE_SCAN_CONCURRENCY = 6
const TOP_USAGE_SESSION_LIMIT = 10
const ARCHIVED_USAGE_CACHE_LIMIT = 100
const THREAD_USAGE_CACHE_LIMIT = 2000

type UsageTotals = Pick<
  ProjectUsageSummary,
  | 'assistantTurnCount'
  | 'cacheRead'
  | 'cacheWrite'
  | 'costTotal'
  | 'input'
  | 'output'
  | 'totalTokens'
>

type ArchivedUsageCacheEntry = {
  summary: ProjectUsageSummary | null
  threadSignature: string
  promise: Promise<ProjectUsageSummary> | null
}

type ThreadUsageCacheEntry = {
  summary: ProjectUsageSessionSummary
  signature: string
}

const archivedUsageCache = new Map<string, ArchivedUsageCacheEntry>()
const threadUsageCache = new Map<string, ThreadUsageCacheEntry>()

function pruneCache<TKey, TValue>(cache: Map<TKey, TValue>, limit: number) {
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) return
    cache.delete(oldestKey)
  }
}

function setBoundedCacheEntry<TKey, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  limit: number,
) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  pruneCache(cache, limit)
}

function finiteNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function emptySessionSummary(input: {
  threadId: string
  title: string
  sessionPath: string
  lastModifiedMs?: number | undefined
}): ProjectUsageSessionSummary {
  return {
    threadId: input.threadId,
    title: input.title,
    sessionPath: input.sessionPath,
    lastModifiedMs: input.lastModifiedMs,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    assistantTurnCount: 0,
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

async function sessionFileExists(sessionPath: string) {
  try {
    await access(sessionPath)
    return true
  } catch (error) {
    if (isMissingFileError(error)) return false

    throw error
  }
}

async function summarizeSession(input: {
  threadId: string
  title: string
  sessionPath: string
  lastModifiedMs?: number | undefined
}) {
  const summary = emptySessionSummary(input)
  if (!(await sessionFileExists(input.sessionPath))) return summary

  const lines = createInterface({
    input: createReadStream(input.sessionPath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of lines) {
    const entry = decodeSessionFileLine(line)
    const usage =
      entry?.type === 'message' && entry.message?.role === 'assistant'
        ? entry.message.usage
        : undefined
    if (!usage) continue

    summary.input += finiteNumber(usage.input)
    summary.output += finiteNumber(usage.output)
    summary.cacheRead += finiteNumber(usage.cacheRead)
    summary.cacheWrite += finiteNumber(usage.cacheWrite)
    summary.totalTokens += finiteNumber(usage.totalTokens)
    summary.costTotal += finiteNumber(usage.cost?.total)
    summary.assistantTurnCount += 1
  }

  return summary
}

function getThreadSignature(threads: Array<{ id: string; lastModifiedMs?: number | undefined }>) {
  return threads.map((thread) => `${thread.id}:${thread.lastModifiedMs ?? 0}`).join('|')
}

function getSessionUsageCacheKey(input: {
  sessionPath: string
  lastModifiedMs?: number | undefined
}) {
  return `${input.sessionPath}:${input.lastModifiedMs ?? 0}`
}

function sumSessionUsage(sessionSummaries: ProjectUsageSessionSummary[]): UsageTotals {
  return sessionSummaries.reduce(
    (current, session) => ({
      assistantTurnCount: current.assistantTurnCount + session.assistantTurnCount,
      cacheRead: current.cacheRead + session.cacheRead,
      cacheWrite: current.cacheWrite + session.cacheWrite,
      costTotal: current.costTotal + session.costTotal,
      input: current.input + session.input,
      output: current.output + session.output,
      totalTokens: current.totalTokens + session.totalTokens,
    }),
    {
      assistantTurnCount: 0,
      cacheRead: 0,
      cacheWrite: 0,
      costTotal: 0,
      input: 0,
      output: 0,
      totalTokens: 0,
    },
  )
}

function combineTotals(left: UsageTotals, right: UsageTotals): UsageTotals {
  return {
    assistantTurnCount: left.assistantTurnCount + right.assistantTurnCount,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    costTotal: left.costTotal + right.costTotal,
    input: left.input + right.input,
    output: left.output + right.output,
    totalTokens: left.totalTokens + right.totalTokens,
  }
}

async function summarizeThreads(projectId: string, threads: ReturnType<typeof listProjectThreads>) {
  const sessionSummaries = await mapWithConcurrency(
    threads,
    PROJECT_USAGE_SCAN_CONCURRENCY,
    async (thread) => {
      if (!thread.sessionPath) {
        return emptySessionSummary({
          threadId: thread.id,
          title: thread.title,
          sessionPath: '',
          lastModifiedMs: thread.lastModifiedMs,
        })
      }

      try {
        const cacheKey = getSessionUsageCacheKey({
          sessionPath: thread.sessionPath,
          lastModifiedMs: thread.lastModifiedMs,
        })
        const cached = threadUsageCache.get(thread.sessionPath)
        if (cached?.signature === cacheKey) return cached.summary
        const summary = await summarizeSession({
          threadId: thread.id,
          title: thread.title,
          sessionPath: thread.sessionPath,
          lastModifiedMs: thread.lastModifiedMs,
        })
        setBoundedCacheEntry(
          threadUsageCache,
          thread.sessionPath,
          { summary, signature: cacheKey },
          THREAD_USAGE_CACHE_LIMIT,
        )
        return summary
      } catch (error) {
        if (!isMissingFileError(error)) {
          console.warn(`Failed to summarize project usage for ${thread.sessionPath}.`, error)
        }
        return emptySessionSummary({
          threadId: thread.id,
          title: thread.title,
          sessionPath: thread.sessionPath,
          lastModifiedMs: thread.lastModifiedMs,
        })
      }
    },
  )
  const totals = sumSessionUsage(sessionSummaries)

  return {
    projectId,
    sessionCount: threads.length,
    sessionsWithUsageCount: sessionSummaries.filter((session) => session.assistantTurnCount > 0)
      .length,
    ...totals,
    topSessions: getTopSessions(sessionSummaries),
  }
}

function getTopSessions(sessionSummaries: ProjectUsageSessionSummary[]) {
  return sessionSummaries
    .filter((session) => session.assistantTurnCount > 0)
    .sort((left, right) =>
      right.costTotal === left.costTotal
        ? right.totalTokens - left.totalTokens
        : right.costTotal - left.costTotal,
    )
    .slice(0, TOP_USAGE_SESSION_LIMIT)
}

function getStoredUsageSummary(projectId: string): ProjectUsageSummary {
  const storedTotals = getProjectStoredUsageTotals(projectId)
  return {
    projectId,
    sessionCount: storedTotals?.sessionCount ?? 0,
    sessionsWithUsageCount: storedTotals?.sessionsWithUsageCount ?? 0,
    assistantTurnCount: storedTotals?.assistantTurnCount ?? 0,
    cacheRead: storedTotals?.cacheRead ?? 0,
    cacheWrite: storedTotals?.cacheWrite ?? 0,
    costTotal: storedTotals?.costTotal ?? 0,
    input: storedTotals?.input ?? 0,
    output: storedTotals?.output ?? 0,
    totalTokens: storedTotals?.totalTokens ?? 0,
    topSessions: [],
  }
}

function getArchivedUsage(projectId: string) {
  const archivedThreads = listArchivedProjectThreads(projectId)
  const threadSignature = getThreadSignature(archivedThreads)
  const cached = archivedUsageCache.get(projectId)
  if (cached?.threadSignature === threadSignature) {
    return { summary: cached.summary, refreshing: Boolean(cached.promise) }
  }

  if (cached?.promise) {
    return { summary: cached.summary, refreshing: true }
  }

  const promise = summarizeThreads(projectId, archivedThreads)
    .then((summary) => {
      setBoundedCacheEntry(
        archivedUsageCache,
        projectId,
        { summary, threadSignature, promise: null },
        ARCHIVED_USAGE_CACHE_LIMIT,
      )
      return summary
    })
    .catch((error) => {
      console.warn(`Failed to summarize archived project usage for ${projectId}.`, error)
      setBoundedCacheEntry(
        archivedUsageCache,
        projectId,
        {
          summary: cached?.summary ?? null,
          threadSignature,
          promise: null,
        },
        ARCHIVED_USAGE_CACHE_LIMIT,
      )
      return cached?.summary ?? summarizeEmptyProject(projectId)
    })

  setBoundedCacheEntry(
    archivedUsageCache,
    projectId,
    {
      summary: cached?.summary ?? null,
      threadSignature,
      promise,
    },
    ARCHIVED_USAGE_CACHE_LIMIT,
  )
  return { summary: cached?.summary ?? null, refreshing: true }
}

function summarizeEmptyProject(projectId: string): ProjectUsageSummary {
  return {
    projectId,
    sessionCount: 0,
    sessionsWithUsageCount: 0,
    assistantTurnCount: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    topSessions: [],
  }
}

export async function loadProjectUsageSummary(projectId: string): Promise<ProjectUsageSummary> {
  const threads = listProjectThreads(projectId)
  const activeSummary = await summarizeThreads(projectId, threads)
  const archivedUsage = getArchivedUsage(projectId)
  const archivedSummary = archivedUsage.summary
  const storedTotalsSummary = getStoredUsageSummary(projectId)
  const activeAndArchivedTotals = archivedSummary
    ? combineTotals(activeSummary, archivedSummary)
    : activeSummary
  const totals = combineTotals(activeAndArchivedTotals, storedTotalsSummary)

  return {
    projectId,
    sessionCount:
      activeSummary.sessionCount +
      (archivedSummary?.sessionCount ?? 0) +
      storedTotalsSummary.sessionCount,
    sessionsWithUsageCount:
      activeSummary.sessionsWithUsageCount +
      (archivedSummary?.sessionsWithUsageCount ?? 0) +
      storedTotalsSummary.sessionsWithUsageCount,
    ...totals,
    archivedUsageRefreshing: archivedUsage.refreshing,
    topSessions: getTopSessions([
      ...activeSummary.topSessions,
      ...(archivedSummary?.topSessions ?? []),
    ]),
  }
}
