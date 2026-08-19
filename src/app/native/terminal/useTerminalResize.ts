import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal as XTerm } from '@xterm/xterm'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { resizeDesktopTerminal } from '../../hooks/useDesktopTerminal'
import {
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  isUsableTerminalSize,
  normalizeTerminalDimension,
} from './terminalViewportUtils'
import { isXtermNearBottom } from './useTerminalOutputBehavior'

type TerminalSize = { cols: number; rows: number }

export function useTerminalResize({
  fitAddonRef,
  scheduleXtermBottomAlign,
  sessionIdRef,
  stickToBottomOnOutput,
  terminalInstanceRef,
  terminalReadyRevision,
  viewportRef,
}: {
  fitAddonRef: RefObject<FitAddon | null>
  scheduleXtermBottomAlign: () => void
  sessionIdRef: RefObject<string | null>
  stickToBottomOnOutput: boolean
  terminalInstanceRef: RefObject<XTerm | null>
  terminalReadyRevision: number
  viewportRef: RefObject<HTMLDivElement | null>
}) {
  const resizeFrameRef = useRef<number | null>(null)
  const resizeTimerRefs = useRef<number[]>([])
  const lastKnownSizeRef = useRef<TerminalSize>({
    cols: DEFAULT_TERMINAL_COLS,
    rows: DEFAULT_TERMINAL_ROWS,
  })
  const lastSentSizeRef = useRef<({ sessionId: string } & TerminalSize) | null>(null)

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      const nextCols = normalizeTerminalDimension(cols, lastKnownSizeRef.current.cols)
      const nextRows = normalizeTerminalDimension(rows, lastKnownSizeRef.current.rows)
      if (!isUsableTerminalSize(nextCols, nextRows)) return

      lastKnownSizeRef.current = { cols: nextCols, rows: nextRows }
      const sessionId = sessionIdRef.current
      if (!sessionId) return

      const nextSize = { sessionId, cols: nextCols, rows: nextRows }
      const lastSentSize = lastSentSizeRef.current
      if (
        lastSentSize?.sessionId === nextSize.sessionId &&
        lastSentSize.cols === nextSize.cols &&
        lastSentSize.rows === nextSize.rows
      ) {
        return
      }

      lastSentSizeRef.current = nextSize
      void resizeDesktopTerminal(nextSize)
    },
    [sessionIdRef],
  )

  const resizeTerminalToContainer = useCallback(() => {
    const terminal = terminalInstanceRef.current
    if (!terminal?.element) return

    const shouldStickToBottom = stickToBottomOnOutput && isXtermNearBottom(terminal)
    fitAddonRef.current?.fit()
    const cols = normalizeTerminalDimension(terminal.cols, lastKnownSizeRef.current.cols)
    const rows = normalizeTerminalDimension(terminal.rows, lastKnownSizeRef.current.rows)
    if (!isUsableTerminalSize(cols, rows)) return

    handleTerminalResize(cols, rows)
    if (shouldStickToBottom) terminal.scrollToBottom()
    scheduleXtermBottomAlign()
  }, [
    fitAddonRef,
    handleTerminalResize,
    scheduleXtermBottomAlign,
    stickToBottomOnOutput,
    terminalInstanceRef,
  ])

  const scheduleTerminalResizeToContainer = useCallback(() => {
    if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current)
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null
      resizeTerminalToContainer()
    })
  }, [resizeTerminalToContainer])

  const cancelScheduledResizes = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = null
    }
    for (const timer of resizeTimerRefs.current) window.clearTimeout(timer)
    resizeTimerRefs.current = []
  }, [])

  const scheduleTerminalResizeSettlingPasses = useCallback(() => {
    scheduleTerminalResizeToContainer()
    for (const timer of resizeTimerRefs.current) window.clearTimeout(timer)
    resizeTimerRefs.current = [80, 240, 600].map((delay) =>
      window.setTimeout(scheduleTerminalResizeToContainer, delay),
    )
  }, [scheduleTerminalResizeToContainer])

  useEffect(() => {
    if (terminalReadyRevision === 0) return
    const viewportElement = viewportRef.current
    if (!viewportElement || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(scheduleTerminalResizeToContainer)
    observer.observe(viewportElement)
    scheduleTerminalResizeSettlingPasses()

    return () => {
      observer.disconnect()
      cancelScheduledResizes()
    }
  }, [
    cancelScheduledResizes,
    scheduleTerminalResizeSettlingPasses,
    scheduleTerminalResizeToContainer,
    terminalReadyRevision,
    viewportRef,
  ])

  useEffect(() => cancelScheduledResizes, [cancelScheduledResizes])

  const getCurrentTerminalSize = useCallback(() => {
    const terminal = terminalInstanceRef.current
    fitAddonRef.current?.fit()
    return {
      cols: normalizeTerminalDimension(
        terminal?.cols ?? lastKnownSizeRef.current.cols,
        lastKnownSizeRef.current.cols,
      ),
      rows: normalizeTerminalDimension(
        terminal?.rows ?? lastKnownSizeRef.current.rows,
        lastKnownSizeRef.current.rows,
      ),
    }
  }, [fitAddonRef, terminalInstanceRef])

  return {
    getCurrentTerminalSize,
    handleTerminalResize,
    lastKnownSizeRef,
    lastSentSizeRef,
    scheduleTerminalResizeSettlingPasses,
  }
}
