import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { type ITheme, Terminal as XTerm } from '@xterm/xterm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPersistedSessionPath } from '../../../../../shared/session-paths'
import { piGuiThemeUpdatedEvent } from '../../../app-shell/usePiGuiTheme'
import type { TerminalEvent } from '../../../desktop/types'
import {
  closeDesktopTerminal,
  openDesktopTerminal,
  resizeDesktopTerminal,
  subscribeDesktopTerminal,
  writeDesktopTerminal,
} from '../../../hooks/useDesktopTerminal'
import { useHoverToFocus } from '../../../hooks/useHoverToFocus'
import { cn } from '../../../utils/cn'
import {
  cancelScheduledTerminalClose,
  scheduleTerminalClose,
  scheduleTerminalCloseAfterSessionFileIdle,
} from './terminalViewportSessionLifecycle'
import {
  clampTerminalHistory,
  clearTerminal,
  DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT,
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  hasVisibleTerminalHistory,
  isUsableTerminalSize,
  MAX_PENDING_TERMINAL_EVENTS,
  MIN_INITIAL_TERMINAL_COLS,
  MIN_INITIAL_TERMINAL_ROWS,
  normalizeTerminalDimension,
  type TerminalBackgroundCssVar,
  terminalStyleVars,
  terminalWrapperStyle,
  writeSystemMessage,
} from './terminalViewportUtils'

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

const XTERM_THEME_COLOR_KEYS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const
const XTERM_STICKY_BOTTOM_THRESHOLD_ROWS = 2

function isXtermNearBottom(terminal: XTerm) {
  return (
    terminal.buffer.active.baseY - terminal.buffer.active.viewportY <=
    XTERM_STICKY_BOTTOM_THRESHOLD_ROWS
  )
}

function resolveCssColor(element: HTMLElement, value: string, fallback: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return fallback

  const probe = element.ownerDocument.createElement('span')
  probe.style.color = trimmedValue
  probe.style.display = 'none'
  element.appendChild(probe)
  const resolvedColor = getComputedStyle(probe).color
  probe.remove()

  return resolvedColor || trimmedValue || fallback
}

function buildXtermTheme(element: HTMLElement): ITheme {
  const styles = getComputedStyle(element)
  const resolve = (value: string, fallback: string) => resolveCssColor(element, value, fallback)
  const color = (cssVar: string, fallback: string) =>
    resolve(styles.getPropertyValue(cssVar), fallback)
  const theme: ITheme = {
    background: color('--term-bg', '#171923'),
    foreground: color('--term-fg', '#d5daed'),
    cursor: color('--term-cursor', '#b9bff3'),
    cursorAccent: color('--term-bg', '#171923'),
    selectionBackground: color('--terminal-selection', 'rgba(185, 191, 243, 0.18)'),
    selectionInactiveBackground: color('--terminal-selection', 'rgba(185, 191, 243, 0.18)'),
  }

  for (const [index, key] of XTERM_THEME_COLOR_KEYS.entries()) {
    theme[key] = color(`--term-color-${index}`, theme.foreground ?? '#d5daed')
  }

  return theme
}

function cleanupTerminalSessionOnUnmount(input: {
  closeWhenSessionFileIdleMs: number
  effectiveLaunchMode: NonNullable<TerminalViewportProps['launchMode']>
  keepAliveMsOnUnmount: number
  maxKeepAliveMsOnUnmount: number
  preserveSessionOnUnmount: boolean
  scheduleTerminalClose: (sessionId: string, keepAliveMs: number) => void
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
    input.scheduleTerminalClose(input.sessionId, input.keepAliveMsOnUnmount)
    return
  }
  void closeDesktopTerminal({
    sessionId: input.sessionId,
    deleteHistory: shouldCloseEmptyPreservedSession,
  })
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
  const pendingScrollFrameRef = useRef<number | null>(null)
  const pendingBottomAlignFrameRef = useRef<number | null>(null)
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
  const terminalPersistedSessionPath =
    getPersistedSessionPath(terminalSessionPath) ??
    (effectiveLaunchMode === 'pi-session' ? getPersistedSessionPath(sessionPath) : null)
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

  const scrollTerminalToBottom = useCallback(() => {
    terminalInstanceRef.current?.scrollToBottom()
  }, [])

  const scheduleTerminalScrollToBottom = useCallback(() => {
    if (pendingScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollFrameRef.current)
    }

    pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollTerminalToBottom()
      pendingScrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollTerminalToBottom()
        pendingScrollFrameRef.current = null
      })
    })
  }, [scrollTerminalToBottom])

  const applyXtermBottomAlign = useCallback(() => {
    const terminal = terminalInstanceRef.current
    const screen = terminal?.element?.querySelector<HTMLElement>('.xterm-screen')
    if (!(terminal && screen)) {
      return
    }

    if (!bottomAlignInitialContent || terminal.buffer.active.baseY > 0) {
      screen.style.transform = ''
      return
    }

    const screenHeight = screen.getBoundingClientRect().height
    const rowHeight = terminal.rows > 0 ? screenHeight / terminal.rows : 0
    if (!(Number.isFinite(rowHeight) && rowHeight > 0)) {
      screen.style.transform = ''
      return
    }

    const cursorY = terminal.buffer.active.cursorY
    const offsetRows = Math.max(0, terminal.rows - cursorY - 1)
    screen.style.transform = offsetRows > 0 ? `translateY(${offsetRows * rowHeight}px)` : ''
  }, [bottomAlignInitialContent])

  const scheduleXtermBottomAlign = useCallback(() => {
    if (pendingBottomAlignFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingBottomAlignFrameRef.current)
    }

    pendingBottomAlignFrameRef.current = window.requestAnimationFrame(() => {
      pendingBottomAlignFrameRef.current = window.requestAnimationFrame(() => {
        pendingBottomAlignFrameRef.current = null
        applyXtermBottomAlign()
      })
    })
  }, [applyXtermBottomAlign])

  const writeToTerminal = useCallback(
    (data: string | Uint8Array) => {
      const terminal = terminalInstanceRef.current
      const shouldStickToBottom =
        stickToBottomOnOutput && (!terminal || isXtermNearBottom(terminal))

      terminal?.write(data, () => {
        scheduleXtermBottomAlign()
        if (shouldStickToBottom) {
          terminal.scrollToBottom()
        }
      })

      if (shouldStickToBottom) {
        scheduleTerminalScrollToBottom()
      }
    },
    [scheduleTerminalScrollToBottom, scheduleXtermBottomAlign, stickToBottomOnOutput],
  )

  useEffect(
    () => () => {
      if (terminalResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(terminalResizeFrameRef.current)
      }
      for (const timer of terminalResizeTimerRefs.current) {
        window.clearTimeout(timer)
      }
      terminalResizeTimerRefs.current = []
      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current)
      }
      if (pendingBottomAlignFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingBottomAlignFrameRef.current)
      }
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
      clearTerminal((data) => writeToTerminal(data))
      if (nextHistory) {
        writeToTerminal(nextHistory)
      }
      scheduleXtermBottomAlign()
    },
    [scheduleXtermBottomAlign, writeToTerminal],
  )

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

  useEffect(() => {
    const mount = terminalMountRef.current
    if (!mount || terminalInstanceRef.current) {
      return
    }

    try {
      const terminal = new XTerm({
        cols: DEFAULT_TERMINAL_COLS,
        rows: DEFAULT_TERMINAL_ROWS,
        cursorBlink: true,
        scrollback: 5_000,
        convertEol: false,
        fontFamily: '"Liberation Mono", Consolas, Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.2,
        theme: buildXtermTheme(mount),
      })
      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(
        new WebLinksAddon((event, uri) => {
          terminal.focus()
          event.preventDefault()
          void window.piDesktop?.openExternal?.(uri).then((opened) => {
            if (!opened) {
              writeSystemMessage((message) => writeToTerminal(message), `Unable to open ${uri}`)
            }
          })
        }),
      )
      terminal.open(mount)
      terminal.onData((data) => handleTerminalData(data))
      terminal.onResize(({ cols, rows }) => handleTerminalResize(cols, rows))
      terminalInstanceRef.current = terminal
      fitAddonRef.current = fitAddon
      fitAddon.fit()
      lastKnownSizeRef.current = {
        cols: normalizeTerminalDimension(terminal.cols, DEFAULT_TERMINAL_COLS),
        rows: normalizeTerminalDimension(terminal.rows, DEFAULT_TERMINAL_ROWS),
      }
      setTerminalInitError(null)
      setTerminalReadyRevision((current) => current + 1)
      terminalInitialFitTimerRef.current = window.setTimeout(() => {
        terminalInitialFitTimerRef.current = null
        fitAddon.fit()
        scheduleXtermBottomAlign()
        terminal.scrollToBottom()
      }, 30)
    } catch (error) {
      handleTerminalError(error)
    }

    return () => {
      if (terminalInitialFitTimerRef.current !== null) {
        window.clearTimeout(terminalInitialFitTimerRef.current)
        terminalInitialFitTimerRef.current = null
      }
      fitAddonRef.current = null
      terminalInstanceRef.current?.dispose()
      terminalInstanceRef.current = null
    }
  }, [
    handleTerminalData,
    handleTerminalError,
    handleTerminalResize,
    scheduleXtermBottomAlign,
    writeToTerminal,
  ])

  useEffect(() => {
    void terminalStyle
    const terminal = terminalInstanceRef.current
    const mount = terminalMountRef.current
    if (!(terminal && mount)) {
      return
    }

    terminal.options.theme = buildXtermTheme(mount)
  }, [terminalStyle])

  useEffect(() => {
    const handleThemeUpdate = () => {
      const terminal = terminalInstanceRef.current
      const mount = terminalMountRef.current
      if (!(terminal && mount)) {
        return
      }

      terminal.options.theme = buildXtermTheme(mount)
    }

    window.addEventListener(piGuiThemeUpdatedEvent, handleThemeUpdate)
    return () => {
      window.removeEventListener(piGuiThemeUpdatedEvent, handleThemeUpdate)
    }
  }, [])

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

  useEffect(() => {
    if (terminalReadyRevision === 0) {
      return
    }

    const terminal = terminalInstanceRef.current
    if (!terminal) {
      return
    }

    let cancelled = false
    attachFailedRef.current = false
    sessionIdRef.current = null
    lastSentSizeRef.current = null
    pendingEventsRef.current = []
    replayingBufferedEventsRef.current = false
    terminalHistoryRef.current = ''
    resetTerminal()

    const bufferPendingEvent = (event: TerminalEvent) => {
      pendingEventsRef.current.push(event)

      if (pendingEventsRef.current.length > MAX_PENDING_TERMINAL_EVENTS) {
        pendingEventsRef.current.splice(
          0,
          pendingEventsRef.current.length - MAX_PENDING_TERMINAL_EVENTS,
        )
      }
    }

    const applyTerminalEvent = (event: TerminalEvent) => {
      switch (event.type) {
        case 'output':
          appendTerminalHistory(event.data)
          break
        case 'error':
          appendTerminalHistory(`\r\n[terminal] ${event.message}\r\n`)
          break
        case 'exited':
          appendTerminalHistory(
            `\r\n[terminal] Process exited${event.exitCode === null ? '' : ` (${event.exitCode})`}.\r\n`,
          )
          onProcessExit?.()
          break
        case 'cleared':
          terminalHistoryRef.current = ''
          clearTerminal((message) => writeToTerminal(message))
          scheduleXtermBottomAlign()
          break
        case 'started':
        case 'restarted':
          resetTerminal(event.snapshot.history)
          break
        default:
          break
      }
    }

    const replayBufferedEvents = (sessionId: string) => {
      replayingBufferedEventsRef.current = true

      while (pendingEventsRef.current.length > 0) {
        const pendingEvents = pendingEventsRef.current.splice(0, pendingEventsRef.current.length)

        for (const event of pendingEvents) {
          if (event.sessionId !== sessionId) {
            continue
          }

          applyTerminalEvent(event)
        }
      }

      replayingBufferedEventsRef.current = false
    }

    const unsubscribe = subscribeDesktopTerminal((event: TerminalEvent) => {
      const sessionId = sessionIdRef.current

      if (!sessionId || replayingBufferedEventsRef.current) {
        if (!attachFailedRef.current) {
          bufferPendingEvent(event)
        }
        return
      }

      if (event.sessionId !== sessionId) {
        return
      }

      applyTerminalEvent(event)
    })

    const getCurrentSize = () => {
      fitAddonRef.current?.fit()

      return {
        cols: normalizeTerminalDimension(terminal.cols, lastKnownSizeRef.current.cols),
        rows: normalizeTerminalDimension(terminal.rows, lastKnownSizeRef.current.rows),
      }
    }

    const openSession = async () => {
      const initialSize = getCurrentSize()
      const size = {
        cols: Math.max(initialSize.cols, MIN_INITIAL_TERMINAL_COLS),
        rows: Math.max(initialSize.rows, MIN_INITIAL_TERMINAL_ROWS),
      }
      const snapshot = await openDesktopTerminal({
        projectId,
        sessionPath: terminalSessionPath,
        launchMode: effectiveLaunchMode,
        cols: size.cols,
        rows: size.rows,
      })

      if (cancelled || !snapshot) {
        return
      }

      attachFailedRef.current = false
      sessionIdRef.current = snapshot.sessionId
      lastSentSizeRef.current = {
        sessionId: snapshot.sessionId,
        cols: snapshot.cols,
        rows: snapshot.rows,
      }
      cancelScheduledTerminalClose(snapshot.sessionId)
      resetTerminal(snapshot.history)

      if (snapshot.status === 'exited') {
        writeSystemMessage(
          (message) => writeToTerminal(message),
          `Process exited${snapshot.exitCode === null ? '' : ` (${snapshot.exitCode})`}.`,
        )
      }

      replayBufferedEvents(snapshot.sessionId)
      terminalInstanceRef.current?.focus()

      const resizedSize = getCurrentSize()
      if (resizedSize.cols !== snapshot.cols || resizedSize.rows !== snapshot.rows) {
        handleTerminalResize(resizedSize.cols, resizedSize.rows)
      }
      scheduleTerminalResizeSettlingPasses()
    }

    void openSession().catch((error) => {
      attachFailedRef.current = true
      pendingEventsRef.current = []
      writeSystemMessage(
        (message) => writeToTerminal(message),
        error instanceof Error ? error.message : 'Unable to open terminal.',
      )
    })

    return () => {
      cancelled = true
      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      pendingEventsRef.current = []
      replayingBufferedEventsRef.current = false
      lastSentSizeRef.current = null
      unsubscribe()
      cleanupTerminalSessionOnUnmount({
        closeWhenSessionFileIdleMs,
        effectiveLaunchMode,
        keepAliveMsOnUnmount,
        maxKeepAliveMsOnUnmount,
        preserveSessionOnUnmount,
        scheduleTerminalClose,
        sessionId,
        terminalHistory: terminalHistoryRef.current,
        terminalPersistedSessionPath,
      })
    }
  }, [
    effectiveLaunchMode,
    appendTerminalHistory,
    closeWhenSessionFileIdleMs,
    handleTerminalResize,
    keepAliveMsOnUnmount,
    maxKeepAliveMsOnUnmount,
    onProcessExit,
    preserveSessionOnUnmount,
    terminalPersistedSessionPath,
    projectId,
    resetTerminal,
    scheduleTerminalResizeSettlingPasses,
    scheduleXtermBottomAlign,
    terminalReadyRevision,
    terminalSessionPath,
    writeToTerminal,
  ])

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
