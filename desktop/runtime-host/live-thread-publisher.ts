import type { AgentMessage } from '@earendil-works/pi-agent-core'
import {
  buildThreadData,
  setThreadCompactingState,
  setThreadStreamingState,
} from '../../shared/thread-data.ts'
import { buildThreadHistorySlice, type SessionPathEntry } from '../../shared/thread-history.ts'
import { isChatSessionPath } from '../chat-state-db.ts'
import { buildComposerState } from '../runtime/composer-state.ts'
import { getPiExtensionUiState } from '../runtime/pi-extension-ui-state.ts'
import type { RuntimeThreadReason } from '../runtime/types.ts'
import { emitDesktopEvent } from './host-events.ts'
import type { LivePiRuntime } from './live-runtime-updates.ts'
import { getLiveToolProgressMessages } from './live-tool-progress.ts'

function normalizeThreadDataForReason(
  thread: ReturnType<typeof buildThreadData>,
  reason: RuntimeThreadReason,
) {
  if (reason === 'compaction-start') return setThreadCompactingState(thread, true)
  if (reason !== 'end' && reason !== 'compaction') return thread
  return setThreadCompactingState(setThreadStreamingState(thread, false), false)
}

function buildLiveThreadData(runtime: LivePiRuntime) {
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return null
  const streamingMessage = runtime.session.state.streamingMessage
  const historySlice = buildThreadHistorySlice(
    [...(runtime.session.sessionManager.getBranch() as SessionPathEntry[])],
    0,
  )
  const sourceMessages = [
    ...historySlice.sourceMessages,
    ...(streamingMessage ? [streamingMessage] : []),
    ...getLiveToolProgressMessages(runtime),
  ] as AgentMessage[]
  return buildThreadData({
    sessionPath,
    sourceMessages,
    sessionName: runtime.session.sessionManager.getSessionName(),
    previousMessageCount: historySlice.previousMessageCount,
    isStreaming: runtime.session.isStreaming,
    isCompacting: runtime.session.isCompacting,
  })
}

export async function publishThreadUpdate(runtime: LivePiRuntime, reason: RuntimeThreadReason) {
  if (!runtime.updates.isActive()) return
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return
  const liveThread = buildLiveThreadData(runtime)
  if (!liveThread) return
  emitDesktopEvent({ type: 'internal-thread-update', sessionPath })
  const composer = await buildComposerState(runtime, { includeContextUsage: reason !== 'update' })
  if (!runtime.updates.isActive()) return
  emitDesktopEvent({
    type: 'thread-update',
    reason,
    projectId: runtime.cwd,
    threadId: runtime.session.sessionId,
    sessionPath,
    branchName: runtime.branchName ?? null,
    chatGroupId: runtime.chatGroupId ?? null,
    isChat: isChatSessionPath(sessionPath),
    thread: normalizeThreadDataForReason(liveThread, reason),
    composer,
  })
}

export function publishComposerUpdate(
  composer: Awaited<ReturnType<typeof buildComposerState>>,
  context: {
    projectId?: string | undefined | null | undefined
    sessionPath?: string | undefined | null | undefined
  } = {},
) {
  emitDesktopEvent({
    type: 'composer-update',
    composer,
    projectId: context.projectId ?? null,
    sessionPath: context.sessionPath ?? null,
  })
}

export function publishPiExtensionUiUpdate(runtime: LivePiRuntime) {
  if (!runtime.updates.isActive()) return
  const sessionPath = runtime.session.sessionFile
  if (!sessionPath) return
  emitDesktopEvent({
    type: 'pi-extension-ui-update',
    projectId: runtime.cwd,
    sessionPath,
    extensionUi: getPiExtensionUiState(runtime),
  })
}

export function cancelLiveThreadUpdate(runtime: LivePiRuntime) {
  runtime.updates.cancelThread()
}

export function deferLiveThreadUpdate(
  runtime: LivePiRuntime,
  options: { requireStreaming?: boolean | undefined } = {},
) {
  runtime.updates.deferThread(() => {
    if (options.requireStreaming !== false && !runtime.session.isStreaming) return
    return publishThreadUpdate(runtime, 'update')
  })
}

export function scheduleLiveThreadUpdate(runtime: LivePiRuntime) {
  runtime.updates.scheduleThread(() => {
    if (!runtime.session.isStreaming) return
    return publishThreadUpdate(runtime, 'update')
  })
}
