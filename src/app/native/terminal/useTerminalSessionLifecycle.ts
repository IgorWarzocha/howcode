import type { TerminalEvent } from '@howcode/desktop'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import {
  closeDesktopTerminal,
  openDesktopTerminal,
  subscribeDesktopTerminal,
} from '../../hooks/useDesktopTerminal'
import {
  bufferPendingTerminalEvent,
  type PendingTerminalEvents,
  takePendingTerminalEvents,
} from './terminal-pending-events'
import {
  createTerminalSessionOwnership,
  getTerminalViewportIdentity,
  type TerminalSessionRelease,
} from './terminal-session-ownership'
import { getTerminalCleanupAction, type TerminalSessionPolicy } from './terminal-session-policy'
import {
  cancelScheduledTerminalClose,
  scheduleTerminalClose,
  scheduleTerminalCloseAfterSessionFileIdle,
} from './terminalViewportSessionLifecycle'
import {
  clearTerminal,
  MIN_INITIAL_TERMINAL_COLS,
  MIN_INITIAL_TERMINAL_ROWS,
  writeSystemMessage,
} from './terminalViewportUtils'

type TerminalLaunchMode = 'shell' | 'pi-session'

type TerminalSize = { cols: number; rows: number }

type TerminalSessionSnapshot = NonNullable<Awaited<ReturnType<typeof openDesktopTerminal>>>

const terminalSessionOwnership = createTerminalSessionOwnership()

type TerminalSessionLifecycleInput = {
  appendTerminalHistory: (chunk: string) => void
  focusTerminal: () => void
  getCurrentSize: () => TerminalSize
  handleTerminalResize: (cols: number, rows: number) => void
  lastSentSizeRef: MutableRefObject<{ sessionId: string; cols: number; rows: number } | null>
  policy: TerminalSessionPolicy
  projectId: string
  resetTerminal: (history?: string) => void
  scheduleTerminalResizeSettlingPasses: () => void
  scheduleXtermBottomAlign: () => void
  sessionIdRef: MutableRefObject<string | null>
  terminalHistoryRef: MutableRefObject<string>
  terminalPersistedSessionPath: string | null
  terminalReadyRevision: number
  terminalSessionPath: string | null
  writeToTerminal: (data: string | Uint8Array) => void
}

function releaseTerminalSession(release: TerminalSessionRelease) {
  switch (release.action.kind) {
    case 'preserve':
      return
    case 'close':
      void closeDesktopTerminal({
        sessionId: release.sessionId,
        deleteHistory: release.action.deleteHistory,
      })
      return
    case 'close-after-delay':
      scheduleTerminalClose(release.sessionId, release.action.delayMs)
      return
    case 'close-after-session-file-idle':
      void scheduleTerminalCloseAfterSessionFileIdle(
        release.sessionId,
        release.action.pollMs,
        release.action.maxKeepAliveMs,
      )
      return
    default:
      return
  }
}

function releaseTerminalSessions(releases: TerminalSessionRelease[]) {
  for (const release of releases) releaseTerminalSession(release)
}

function rememberOpenedSession(input: {
  lastSentSizeRef: MutableRefObject<{ sessionId: string; cols: number; rows: number } | null>
  sessionIdRef: MutableRefObject<string | null>
  snapshot: TerminalSessionSnapshot
}) {
  input.sessionIdRef.current = input.snapshot.sessionId
  input.lastSentSizeRef.current = {
    sessionId: input.snapshot.sessionId,
    cols: input.snapshot.cols,
    rows: input.snapshot.rows,
  }
  cancelScheduledTerminalClose(input.snapshot.sessionId)
}

function activateOpenedSession(input: {
  lifecycle: TerminalSessionLifecycleInput
  replayBufferedEvents: (sessionId: string) => void
  snapshot: TerminalSessionSnapshot
}) {
  rememberOpenedSession({
    lastSentSizeRef: input.lifecycle.lastSentSizeRef,
    sessionIdRef: input.lifecycle.sessionIdRef,
    snapshot: input.snapshot,
  })
  input.lifecycle.resetTerminal(input.snapshot.history)
  if (input.snapshot.status === 'exited') {
    writeSystemMessage(
      (message) => input.lifecycle.writeToTerminal(message),
      `Process exited${input.snapshot.exitCode === null ? '' : ` (${input.snapshot.exitCode})`}.`,
    )
  }
  input.replayBufferedEvents(input.snapshot.sessionId)
  input.lifecycle.focusTerminal()

  const resizedSize = input.lifecycle.getCurrentSize()
  if (resizedSize.cols !== input.snapshot.cols || resizedSize.rows !== input.snapshot.rows) {
    input.lifecycle.handleTerminalResize(resizedSize.cols, resizedSize.rows)
  }
  input.lifecycle.scheduleTerminalResizeSettlingPasses()
}

export function useTerminalSessionLifecycle(input: TerminalSessionLifecycleInput) {
  useEffect(() => {
    if (input.terminalReadyRevision === 0) return

    let cancelled = false
    let acceptPendingEvents = true
    const pendingEvents: PendingTerminalEvents = new Map()
    input.sessionIdRef.current = null
    input.lastSentSizeRef.current = null
    input.terminalHistoryRef.current = ''
    input.resetTerminal()
    const launchMode: TerminalLaunchMode = input.policy.kind
    const viewportIdentity = getTerminalViewportIdentity({
      launchMode,
      projectId: input.projectId,
      sessionPath: input.terminalSessionPath,
    })
    const releaseReadyTerminalSessions = () => {
      queueMicrotask(() => {
        releaseTerminalSessions(terminalSessionOwnership.takeReadyReleases(viewportIdentity))
      })
    }
    const viewport = terminalSessionOwnership.begin(viewportIdentity)

    const applyEvent = (event: TerminalEvent) => {
      switch (event.type) {
        case 'output':
          input.appendTerminalHistory(event.data)
          break
        case 'error':
          input.appendTerminalHistory(`\r\n[terminal] ${event.message}\r\n`)
          break
        case 'exited':
          input.appendTerminalHistory(
            `\r\n[terminal] Process exited${event.exitCode === null ? '' : ` (${event.exitCode})`}.\r\n`,
          )
          break
        case 'cleared':
          input.terminalHistoryRef.current = ''
          clearTerminal((message) => input.writeToTerminal(message))
          input.scheduleXtermBottomAlign()
          break
        case 'started':
        case 'restarted':
          input.resetTerminal(event.snapshot.history)
          break
        default:
          break
      }
    }

    const replayBufferedEvents = (sessionId: string) => {
      for (const event of takePendingTerminalEvents(pendingEvents, sessionId)) applyEvent(event)
    }

    const unsubscribe = subscribeDesktopTerminal((event: TerminalEvent) => {
      const sessionId = input.sessionIdRef.current
      if (!sessionId) {
        if (acceptPendingEvents) bufferPendingTerminalEvent(pendingEvents, event)
        return
      }
      if (event.sessionId === sessionId) applyEvent(event)
    })

    const openSession = async () => {
      const initialSize = input.getCurrentSize()
      const size = {
        cols: Math.max(initialSize.cols, MIN_INITIAL_TERMINAL_COLS),
        rows: Math.max(initialSize.rows, MIN_INITIAL_TERMINAL_ROWS),
      }
      const snapshot = await openDesktopTerminal({
        projectId: input.projectId,
        sessionPath: input.terminalSessionPath,
        launchMode,
        cols: size.cols,
        rows: size.rows,
      })
      if (!snapshot) {
        terminalSessionOwnership.failed(viewport)
        releaseReadyTerminalSessions()
        return
      }

      const adopted = terminalSessionOwnership.opened(viewport, {
        sessionId: snapshot.sessionId,
        action: getTerminalCleanupAction({
          policy: input.policy,
          terminalHistory: snapshot.history,
          terminalPersistedSessionPath: input.terminalPersistedSessionPath,
        }),
      })
      releaseReadyTerminalSessions()
      if (!adopted) return

      acceptPendingEvents = false
      activateOpenedSession({
        lifecycle: input,
        replayBufferedEvents,
        snapshot,
      })
    }

    void openSession().catch((error) => {
      terminalSessionOwnership.failed(viewport)
      releaseReadyTerminalSessions()
      acceptPendingEvents = false
      pendingEvents.clear()
      if (cancelled) return
      writeSystemMessage(
        (message) => input.writeToTerminal(message),
        error instanceof Error ? error.message : 'Unable to open terminal.',
      )
    })

    return () => {
      cancelled = true
      input.sessionIdRef.current = null
      pendingEvents.clear()
      input.lastSentSizeRef.current = null
      unsubscribe()
      terminalSessionOwnership.leave(
        viewport,
        getTerminalCleanupAction({
          policy: input.policy,
          terminalHistory: input.terminalHistoryRef.current,
          terminalPersistedSessionPath: input.terminalPersistedSessionPath,
        }),
      )
      releaseReadyTerminalSessions()
    }
  }, [input])
}
