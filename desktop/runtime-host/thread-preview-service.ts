import { buildPathEntriesToEntryId } from '../../shared/session-tree-preview.ts'
import { buildThreadData } from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { getPiModule } from '../pi-module.ts'

type FileSessionEntry = SessionPathEntry & { parentId?: string | null | undefined }

function fileEntriesToPreviewPathEntries(entries: readonly FileSessionEntry[]): FileSessionEntry[] {
  return entries.map((entry) => ({
    ...entry,
    parentId: entry.parentId ?? null,
  }))
}

export async function loadThreadPreviewAtEntry(request: {
  sessionPath: string
  targetEntryId: string
  historyCompactions?: number | undefined
}) {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const allEntries = fileEntriesToPreviewPathEntries(manager.getEntries() as FileSessionEntry[])
  const pathEntries = buildPathEntriesToEntryId(allEntries, request.targetEntryId)
  if (!pathEntries) {
    throw new Error('Session tree entry not found')
  }

  const historySlice = buildThreadHistorySlice(pathEntries, request.historyCompactions ?? 0)

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
