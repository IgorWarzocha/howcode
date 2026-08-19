import { normalizeThreadTitle } from '../../shared/pi-message-mapper.ts'
import { buildThreadData } from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { searchThreadData } from '../../shared/thread-search.ts'
import { getPiModule } from '../pi-module.ts'
import { getCachedRuntimeForSessionPath } from './live-runtime-registry.ts'

export async function loadThreadSnapshot(request: {
  sessionPath: string
  historyCompactions?: number | undefined
}) {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const historySlice = buildThreadHistorySlice(manager.getBranch(), request.historyCompactions ?? 0)

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath: request.sessionPath,
      sourceMessages: historySlice.sourceMessages,
      sessionName: manager.getSessionName(),
      previousMessageCount: historySlice.previousMessageCount,
      isStreaming: false,
      isCompacting: false,
    }),
  }
}

export async function renameThreadSession(request: { sessionPath: string; name: string }) {
  const name = request.name.trim()
  if (!name) throw new Error('Session name is required.')

  const runtime = await getCachedRuntimeForSessionPath(request.sessionPath)
  if (runtime) {
    runtime.session.setSessionName(name)
    return {
      projectId: runtime.cwd,
      threadId: runtime.session.sessionId,
      title: normalizeThreadTitle(runtime.session.sessionManager.getSessionName() ?? name),
    }
  }

  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  manager.appendSessionInfo(name)
  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    title: normalizeThreadTitle(manager.getSessionName() ?? name),
  }
}

export async function searchThreadSnapshot(request: { sessionPath: string; query: string }) {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const pathEntries: SessionPathEntry[] = manager.getBranch()
  const thread = buildThreadData({
    sessionPath: request.sessionPath,
    sourceMessages: buildThreadHistorySlice(pathEntries, -1).sourceMessages,
    sessionName: manager.getSessionName(),
    previousMessageCount: 0,
    isStreaming: false,
    isCompacting: false,
  })

  const result = searchThreadData(thread, request.query)
  const revealHistoryCompactionsByMessageId = getRevealHistoryCompactionsByMessageId({
    pathEntries,
    sessionPath: request.sessionPath,
  })
  return {
    ...result,
    matches: result.matches.map((match) => ({
      ...match,
      revealHistoryCompactions: revealHistoryCompactionsByMessageId.get(match.messageId) ?? 0,
    })),
  }
}

function getRevealHistoryCompactionsByMessageId(input: {
  pathEntries: SessionPathEntry[]
  sessionPath: string
}) {
  const revealHistoryCompactionsByMessageId = new Map<string, number>()
  for (
    let historyCompactions = 0;
    historyCompactions <= input.pathEntries.length;
    historyCompactions += 1
  ) {
    const historySlice = buildThreadHistorySlice(input.pathEntries, historyCompactions)
    const thread = buildThreadData({
      sessionPath: input.sessionPath,
      sourceMessages: historySlice.sourceMessages,
      previousMessageCount: historySlice.previousMessageCount,
      isStreaming: false,
      isCompacting: false,
    })
    for (const message of thread.messages) {
      if (!revealHistoryCompactionsByMessageId.has(message.id)) {
        revealHistoryCompactionsByMessageId.set(message.id, historyCompactions)
      }
    }
    if (historySlice.previousMessageCount === 0) break
  }
  return revealHistoryCompactionsByMessageId
}
