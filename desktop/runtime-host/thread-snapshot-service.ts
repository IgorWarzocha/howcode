import { buildThreadData } from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { searchThreadData } from '../../shared/thread-search.ts'
import { getPiModule } from '../pi-module.ts'

export async function loadThreadSnapshot(request: {
  sessionPath: string
  historyCompactions?: number | undefined
}) {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const historySlice = buildThreadHistorySlice(
    [...(manager.getBranch() as SessionPathEntry[])],
    request.historyCompactions ?? 0,
  )

  return {
    projectId: manager.getCwd(),
    threadId: manager.getSessionId(),
    thread: buildThreadData({
      sessionPath: request.sessionPath,
      sourceMessages: historySlice.sourceMessages,
      previousMessageCount: historySlice.previousMessageCount,
      isStreaming: false,
      isCompacting: false,
    }),
  }
}

export async function searchThreadSnapshot(request: { sessionPath: string; query: string }) {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const pathEntries = [...(manager.getBranch() as SessionPathEntry[])]
  const thread = buildThreadData({
    sessionPath: request.sessionPath,
    sourceMessages: buildThreadHistorySlice(pathEntries, -1).sourceMessages,
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
