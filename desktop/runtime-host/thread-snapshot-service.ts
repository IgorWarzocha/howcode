import { buildThreadData } from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { searchThreadData, type ThreadSearchMatch } from '../../shared/thread-search.ts'
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
  return {
    ...result,
    matches: result.matches.map((match) => ({
      ...match,
      revealHistoryCompactions: getRevealHistoryCompactions({
        match,
        pathEntries,
        sessionPath: request.sessionPath,
      }),
    })),
  }
}

function getRevealHistoryCompactions(input: {
  match: ThreadSearchMatch
  pathEntries: SessionPathEntry[]
  sessionPath: string
}) {
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
    if (thread.messages.some((message) => message.id === input.match.messageId)) {
      return historyCompactions
    }
    if (historySlice.previousMessageCount === 0) return historyCompactions
  }
  return 0
}
