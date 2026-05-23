import type { TerminalEvent } from '@howcode/desktop'
import { getPersistedSessionPath, isLocalSessionPath } from '@howcode/shared/session-paths'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import {
  closeDesktopTerminal,
  openDesktopTerminal,
  subscribeDesktopTerminal,
} from '../../hooks/useDesktopTerminal'
import {
  cancelScheduledTerminalClose,
  scheduleTerminalClose,
  scheduleTerminalCloseAfterSessionFileIdle,
} from './terminalViewportSessionLifecycle'
import {
  clearTerminal,
  hasVisibleTerminalHistory,
  MAX_PENDING_TERMINAL_EVENTS,
  MIN_INITIAL_TERMINAL_COLS,
  MIN_INITIAL_TERMINAL_ROWS,
  writeSystemMessage,
} from './terminalViewportUtils'

type TerminalLaunchMode = 'shell' | 'pi-session'

type TerminalSize = { cols: number; rows: number }

type TerminalSessionSnapshot = NonNullable<Awaited<ReturnType<typeof openDesktopTerminal>>>

type TerminalSessionLifecycleInput = {
  appendTerminalHistory: (chunk: string) => void
  attachFailedRef: MutableRefObject<boolean>
  closeWhenSessionFileIdleMs: number
  effectiveLaunchMode: TerminalLaunchMode
  focusTerminal: () => void
  getCurrentSize: () => TerminalSize
  handleTerminalResize: (cols: number, rows: number) => void
  keepAliveMsOnUnmount: number
  lastSentSizeRef: MutableRefObject<{ sessionId: string; cols: number; rows: number } | null>
  maxKeepAliveMsOnUnmount: number
  onProcessExit: (() => void) | undefined
  pendingEventsRef: MutableRefObject<TerminalEvent[]>
  preserveSessionOnUnmount: boolean
  projectId: string
  replayingBufferedEventsRef: MutableRefObject<boolean>
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

export function getTerminalPersistedSessionPath(input: {
  effectiveLaunchMode: TerminalLaunchMode
  sessionPath: string | null
  terminalSessionPath: string | null | undefined
}) {
  if (input.effectiveLaunchMode === 'pi-session') {
    return (
      getPersistedSessionPath(input.terminalSessionPath ?? null) ??
      (isLocalSessionPath(input.terminalSessionPath)
        ? getPersistedSessionPath(input.sessionPath)
        : null)
    )
  }

  return getPersistedSessionPath(input.terminalSessionPath ?? input.sessionPath)
}

function cleanupTerminalSessionOnUnmount(input: {
  closeWhenSessionFileIdleMs: number
  effectiveLaunchMode: TerminalLaunchMode
  keepAliveMsOnUnmount: number
  maxKeepAliveMsOnUnmount: number
  preserveSessionOnUnmount: boolean
  sessionId: string | null
  terminalHistory: string
  terminalPersistedSessionPath: string | null
}) {
  if (!input.sessionId) return
  const shouldCloseEmptyPreservedSession =
    input.preserveSessionOnUnmount &&
    input.effectiveLaunchMode === 'shell' &&
    !hasVisibleTerminalHistory(input.terminalHistory)
  if (input.preserveSessionOnUnmount && !shouldCloseEmptyPreservedSession) return
  if (
    !shouldCloseEmptyPreservedSession &&
    input.closeWhenSessionFileIdleMs > 0 &&
    input.terminalPersistedSessionPath
  ) {
    void scheduleTerminalCloseAfterSessionFileIdle(
      input.sessionId,
      input.closeWhenSessionFileIdleMs,
      input.maxKeepAliveMsOnUnmount,
    )
    return
  }
  if (!shouldCloseEmptyPreservedSession && input.keepAliveMsOnUnmount > 0) {
    scheduleTerminalClose(input.sessionId, input.keepAliveMsOnUnmount)
    return
  }
  void closeDesktopTerminal({
    sessionId: input.sessionId,
    deleteHistory: shouldCloseEmptyPreservedSession,
  })
}

function bufferPendingEvent(
  pendingEventsRef: MutableRefObject<TerminalEvent[]>,
  event: TerminalEvent,
) {
  pendingEventsRef.current.push(event)
  if (pendingEventsRef.current.length > MAX_PENDING_TERMINAL_EVENTS) {
    pendingEventsRef.current.splice(
      0,
      pendingEventsRef.current.length - MAX_PENDING_TERMINAL_EVENTS,
    )
  }
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

export function useTerminalSessionLifecycle(input: TerminalSessionLifecycleInput) {
  useEffect(() => {
    if (input.terminalReadyRevision === 0) return

    let cancelled = false
    input.attachFailedRef.current = false
    input.sessionIdRef.current = null
    input.lastSentSizeRef.current = null
    input.pendingEventsRef.current = []
    input.replayingBufferedEventsRef.current = false
    input.terminalHistoryRef.current = ''
    input.resetTerminal()

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
          input.onProcessExit?.()
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
      input.replayingBufferedEventsRef.current = true
      while (input.pendingEventsRef.current.length > 0) {
        const pendingEvents = input.pendingEventsRef.current.splice(
          0,
          input.pendingEventsRef.current.length,
        )
        for (const event of pendingEvents) {
          if (event.sessionId === sessionId) applyEvent(event)
        }
      }
      input.replayingBufferedEventsRef.current = false
    }

    const unsubscribe = subscribeDesktopTerminal((event: TerminalEvent) => {
      const sessionId = input.sessionIdRef.current
      if (!sessionId || input.replayingBufferedEventsRef.current) {
        if (!input.attachFailedRef.current) bufferPendingEvent(input.pendingEventsRef, event)
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
        launchMode: input.effectiveLaunchMode,
        cols: size.cols,
        rows: size.rows,
      })
      if (cancelled || !snapshot) return

      input.attachFailedRef.current = false
      rememberOpenedSession({
        lastSentSizeRef: input.lastSentSizeRef,
        sessionIdRef: input.sessionIdRef,
        snapshot,
      })
      input.resetTerminal(snapshot.history)
      if (snapshot.status === 'exited') {
        writeSystemMessage(
          (message) => input.writeToTerminal(message),
          `Process exited${snapshot.exitCode === null ? '' : ` (${snapshot.exitCode})`}.`,
        )
      }
      replayBufferedEvents(snapshot.sessionId)
      input.focusTerminal()

      const resizedSize = input.getCurrentSize()
      if (resizedSize.cols !== snapshot.cols || resizedSize.rows !== snapshot.rows) {
        input.handleTerminalResize(resizedSize.cols, resizedSize.rows)
      }
      input.scheduleTerminalResizeSettlingPasses()
    }

    void openSession().catch((error) => {
      input.attachFailedRef.current = true
      input.pendingEventsRef.current = []
      writeSystemMessage(
        (message) => input.writeToTerminal(message),
        error instanceof Error ? error.message : 'Unable to open terminal.',
      )
    })

    return () => {
      cancelled = true
      const sessionId = input.sessionIdRef.current
      input.sessionIdRef.current = null
      input.pendingEventsRef.current = []
      input.replayingBufferedEventsRef.current = false
      input.lastSentSizeRef.current = null
      unsubscribe()
      cleanupTerminalSessionOnUnmount({
        closeWhenSessionFileIdleMs: input.closeWhenSessionFileIdleMs,
        effectiveLaunchMode: input.effectiveLaunchMode,
        keepAliveMsOnUnmount: input.keepAliveMsOnUnmount,
        maxKeepAliveMsOnUnmount: input.maxKeepAliveMsOnUnmount,
        preserveSessionOnUnmount: input.preserveSessionOnUnmount,
        sessionId,
        terminalHistory: input.terminalHistoryRef.current,
        terminalPersistedSessionPath: input.terminalPersistedSessionPath,
      })
    }
  }, [input])
}
