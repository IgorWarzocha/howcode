import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../../app-shell/keybinding-events'
import type { TerminalEvent } from '../../../desktop/types'
import { resizeDesktopTerminal, writeDesktopTerminal } from '../../../hooks/useDesktopTerminal'
import { useHoverToFocus } from '../../../hooks/useHoverToFocus'
import { cn } from '../../../utils/cn'
import {
  clampTerminalHistory,
  clearTerminal,
  DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  isUsableTerminalSize,
  normalizeTerminalDimension,
  type TerminalBackgroundCssVar,
  terminalStyleVars,
  terminalWrapperStyle,
  writeSystemMessage,
} from './terminalViewportUtils'
import { isXtermNearBottom, useTerminalOutputBehavior } from './useTerminalOutputBehavior'
import {
  getTerminalPersistedSessionPath,
  useTerminalSessionLifecycle,
} from './useTerminalSessionLifecycle'
import { useTerminalXtermInstance } from './useTerminalXtermInstance'

type TerminalViewportProps = {
  projectId: string
  sessionPath: string | null
  launchMode?: 'shell' | 'pi-session' | undefined
  onProcessExit?: (() => void) | undefined
  preserveSessionOnUnmount?: boolean | undefined
  keepAliveMsOnUnmount?: number | undefined
  closeWhenSessionFileIdleMs?: number | undefined
  maxKeepAliveMsOnUnmount?: number | undefined
  backgroundCssVar?: TerminalBackgroundCssVar | undefined
  hoverToFocus?: boolean | undefined
  hoverToBlur?: boolean | undefined
  stickToBottomOnOutput?: boolean | undefined
  bottomAlignInitialContent?: boolean | undefined
  className?: string | undefined
}

export function TerminalViewport({
  projectId,
  sessionPath,
  launchMode = 'shell',
  onProcessExit,
  preserveSessionOnUnmount = false,
  keepAliveMsOnUnmount = 0,
  closeWhenSessionFileIdleMs = 0,
  maxKeepAliveMsOnUnmount = DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  backgroundCssVar = '--terminal-bg',
  hoverToFocus = true,
  hoverToBlur = false,
  stickToBottomOnOutput = true,
  bottomAlignInitialContent = false,
  className,
}: TerminalViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const terminalMountRef = useRef<HTMLDivElement | null>(null)
  const terminalInstanceRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalResizeFrameRef = useRef<number | null>(null)
  const terminalResizeTimerRefs = useRef<number[]>([])
  const terminalInitialFitTimerRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const attachFailedRef = useRef(false)
  const pendingEventsRef = useRef<TerminalEvent[]>([])
  const replayingBufferedEventsRef = useRef(false)
  const terminalHistoryRef = useRef('')
  const piSessionPathRef = useRef<{ value: string | null } | null>(null)
  const lastKnownSizeRef = useRef({ cols: DEFAULT_TERMINAL_COLS, rows: DEFAULT_TERMINAL_ROWS })
  const lastSentSizeRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null)
  const [terminalReadyRevision, setTerminalReadyRevision] = useState(0)
  const [terminalInitError, setTerminalInitError] = useState<string | null>(null)
  const effectiveLaunchMode = launchMode
  if (effectiveLaunchMode === 'pi-session' && piSessionPathRef.current === null) {
    piSessionPathRef.current = { value: sessionPath }
  }
  const terminalSessionPath =
    effectiveLaunchMode === 'pi-session' ? piSessionPathRef.current?.value : sessionPath
  const terminalPersistedSessionPath = getTerminalPersistedSessionPath({
    effectiveLaunchMode,
    sessionPath,
    terminalSessionPath,
  })
  const viewportStyle = useMemo(() => terminalWrapperStyle(backgroundCssVar), [backgroundCssVar])
  const terminalStyle = useMemo(() => terminalStyleVars(backgroundCssVar), [backgroundCssVar])
  const focusTerminal = useCallback(() => {
    terminalInstanceRef.current?.focus()
  }, [])
  const blurTerminal = useCallback(() => {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }
  }, [])
  const isTerminalFocused = useCallback(() => {
    const terminalElement = terminalInstanceRef.current?.element
    const activeElement = document.activeElement
    return !!terminalElement && !!activeElement && terminalElement.contains(activeElement)
  }, [])
  const handleHoverToFocus = useHoverToFocus({
    enabled: hoverToFocus,
    boundaryRef: viewportRef,
    focus: focusTerminal,
    blur: blurTerminal,
    blurOnLeave: hoverToBlur,
    isFocused: isTerminalFocused,
  })

  const { scheduleXtermBottomAlign, writeToTerminal } = useTerminalOutputBehavior({
    bottomAlignInitialContent,
    stickToBottomOnOutput,
    terminalInstanceRef,
  })

  useEffect(
    () => () => {
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current)
      }
      for (const timer of terminalResizeTimerRefs.current) {
        window.clearTimeout(timer)
      }
      terminalResizeTimerRefs.current = []
      if (terminalInitialFitTimerRef.current !== null) {
        window.clearTimeout(terminalInitialFitTimerRef.current)
      }
    },
    [],
  )

  const resetTerminal = useCallback(
    (history = '') => {
      const nextHistory = clampTerminalHistory(history)
      terminalHistoryRef.current = nextHistory
      if (nextHistory) clearTerminal((data) => writeToTerminal(data))
      else terminalInstanceRef.current?.clear()
      if (nextHistory) {
        writeToTerminal(nextHistory)
      }
      scheduleXtermBottomAlign()
    },
    [scheduleXtermBottomAlign, writeToTerminal],
  )

  useHowcodeKeybindingCommand('terminal.clear', (event) => {
    if (!isTerminalFocused()) return
    event.preventDefault()
    resetTerminal('')
  })

  const appendTerminalHistory = useCallback(
    (chunk: string) => {
      const nextHistory = clampTerminalHistory(terminalHistoryRef.current + chunk)
      const trimmed = nextHistory.length !== terminalHistoryRef.current.length + chunk.length
      terminalHistoryRef.current = nextHistory

      if (trimmed) {
        clearTerminal((data) => writeToTerminal(data))
        if (nextHistory) {
          writeToTerminal(nextHistory)
        }
        return
      }

      writeToTerminal(chunk)
    },
    [writeToTerminal],
  )

  const handleTerminalError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unable to initialize terminal.'
    setTerminalInitError(message)
  }, [])

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    const nextCols = normalizeTerminalDimension(cols, lastKnownSizeRef.current.cols)
    const nextRows = normalizeTerminalDimension(rows, lastKnownSizeRef.current.rows)

    if (!isUsableTerminalSize(nextCols, nextRows)) {
      return
    }

    lastKnownSizeRef.current = {
      cols: nextCols,
      rows: nextRows,
    }

    const sessionId = sessionIdRef.current
    if (!sessionId) {
      return
    }

    const nextSize = { sessionId, cols: nextCols, rows: nextRows }
    const lastSentSize = lastSentSizeRef.current

    if (
      lastSentSize &&
      lastSentSize.sessionId === nextSize.sessionId &&
      lastSentSize.cols === nextSize.cols &&
      lastSentSize.rows === nextSize.rows
    ) {
      return
    }

    lastSentSizeRef.current = nextSize
    void resizeDesktopTerminal(nextSize)
  }, [])

  const handleTerminalData = useCallback(
    (data: string) => {
      const sessionId = sessionIdRef.current
      if (!sessionId) {
        return
      }

      void writeDesktopTerminal(sessionId, data).catch((error) => {
        writeSystemMessage(
          (message) => writeToTerminal(message),
          error instanceof Error ? error.message : 'Terminal write failed.',
        )
      })
    },
    [writeToTerminal],
  )

  useTerminalXtermInstance({
    fitAddonRef,
    handleTerminalData,
    handleTerminalError,
    handleTerminalResize,
    lastKnownSizeRef,
    scheduleXtermBottomAlign,
    setTerminalInitError,
    setTerminalReadyRevision,
    terminalInitialFitTimerRef,
    terminalInstanceRef,
    terminalMountRef,
    terminalStyle,
    writeToTerminal,
  })

  const resizeTerminalToContainer = useCallback(() => {
    const terminal = terminalInstanceRef.current
    const terminalElement = terminal?.element
    if (!(terminal && terminalElement)) {
      return
    }

    const shouldStickToBottom = stickToBottomOnOutput && isXtermNearBottom(terminal)
    fitAddonRef.current?.fit()
    const cols = normalizeTerminalDimension(terminal.cols, lastKnownSizeRef.current.cols)
    const rows = normalizeTerminalDimension(terminal.rows, lastKnownSizeRef.current.rows)
    if (!isUsableTerminalSize(cols, rows)) {
      return
    }
    handleTerminalResize(cols, rows)

    if (shouldStickToBottom) {
      terminal.scrollToBottom()
    }
    scheduleXtermBottomAlign()
  }, [handleTerminalResize, scheduleXtermBottomAlign, stickToBottomOnOutput])

  const scheduleTerminalResizeToContainer = useCallback(() => {
    if (terminalResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(terminalResizeFrameRef.current)
    }

    terminalResizeFrameRef.current = window.requestAnimationFrame(() => {
      terminalResizeFrameRef.current = null
      resizeTerminalToContainer()
    })
  }, [resizeTerminalToContainer])

  const scheduleTerminalResizeSettlingPasses = useCallback(() => {
    scheduleTerminalResizeToContainer()

    for (const timer of terminalResizeTimerRefs.current) {
      window.clearTimeout(timer)
    }

    terminalResizeTimerRefs.current = [80, 240, 600].map((delay) =>
      window.setTimeout(() => {
        scheduleTerminalResizeToContainer()
      }, delay),
    )
  }, [scheduleTerminalResizeToContainer])

  useEffect(() => {
    if (terminalReadyRevision === 0) {
      return
    }

    const viewportElement = viewportRef.current
    if (!viewportElement || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      scheduleTerminalResizeToContainer()
    })

    observer.observe(viewportElement)
    scheduleTerminalResizeSettlingPasses()

    return () => {
      observer.disconnect()
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current)
        terminalResizeFrameRef.current = null
      }
      for (const timer of terminalResizeTimerRefs.current) {
        window.clearTimeout(timer)
      }
      terminalResizeTimerRefs.current = []
    }
  }, [
    scheduleTerminalResizeSettlingPasses,
    scheduleTerminalResizeToContainer,
    terminalReadyRevision,
  ])

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
  }, [])

  const terminalSessionLifecycle = useMemo(
    () => ({
      appendTerminalHistory,
      attachFailedRef,
      closeWhenSessionFileIdleMs,
      effectiveLaunchMode,
      focusTerminal,
      getCurrentSize: getCurrentTerminalSize,
      handleTerminalResize,
      keepAliveMsOnUnmount,
      lastSentSizeRef,
      maxKeepAliveMsOnUnmount,
      onProcessExit,
      pendingEventsRef,
      preserveSessionOnUnmount,
      projectId,
      replayingBufferedEventsRef,
      resetTerminal,
      scheduleTerminalResizeSettlingPasses,
      scheduleXtermBottomAlign,
      sessionIdRef,
      terminalHistoryRef,
      terminalPersistedSessionPath,
      terminalReadyRevision,
      terminalSessionPath: terminalSessionPath ?? null,
      writeToTerminal,
    }),
    [
      appendTerminalHistory,
      closeWhenSessionFileIdleMs,
      effectiveLaunchMode,
      focusTerminal,
      getCurrentTerminalSize,
      handleTerminalResize,
      keepAliveMsOnUnmount,
      maxKeepAliveMsOnUnmount,
      onProcessExit,
      preserveSessionOnUnmount,
      projectId,
      resetTerminal,
      scheduleTerminalResizeSettlingPasses,
      scheduleXtermBottomAlign,
      terminalPersistedSessionPath,
      terminalReadyRevision,
      terminalSessionPath,
      writeToTerminal,
    ],
  )
  useTerminalSessionLifecycle(terminalSessionLifecycle)

  return (
    <div
      ref={viewportRef}
      style={viewportStyle}
      onPointerEnter={handleHoverToFocus}
      className={cn(
        'terminal-viewport relative h-full min-h-[220px] min-w-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[color:var(--terminal-surface)] text-[color:var(--text)]',
        className,
      )}
    >
      <div ref={terminalMountRef} className="h-full w-full" style={terminalStyle} />
      {terminalInitError ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start bg-[color:var(--terminal-surface)]/92 px-4 py-3 text-[12px] leading-5 text-[color:var(--text)]">
          <span>[terminal] {terminalInitError}</span>
        </div>
      ) : null}
    </div>
  )
}
