import type { Terminal as XTerm } from '@xterm/xterm'
import { type RefObject, useCallback, useEffect, useRef } from 'react'

const XTERM_STICKY_BOTTOM_THRESHOLD_ROWS = 2

export function isXtermNearBottom(terminal: XTerm) {
  return (
    terminal.buffer.active.baseY - terminal.buffer.active.viewportY <=
    XTERM_STICKY_BOTTOM_THRESHOLD_ROWS
  )
}

export function useTerminalOutputBehavior({
  bottomAlignInitialContent,
  stickToBottomOnOutput,
  terminalInstanceRef,
}: {
  bottomAlignInitialContent: boolean
  stickToBottomOnOutput: boolean
  terminalInstanceRef: RefObject<XTerm | null>
}) {
  const pendingScrollFrameRef = useRef<number | null>(null)
  const pendingBottomAlignFrameRef = useRef<number | null>(null)

  const scrollTerminalToBottom = useCallback(() => {
    terminalInstanceRef.current?.scrollToBottom()
  }, [terminalInstanceRef])

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
  }, [bottomAlignInitialContent, terminalInstanceRef])

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
        if (shouldStickToBottom) terminal.scrollToBottom()
      })

      if (shouldStickToBottom) scheduleTerminalScrollToBottom()
    },
    [
      scheduleTerminalScrollToBottom,
      scheduleXtermBottomAlign,
      stickToBottomOnOutput,
      terminalInstanceRef,
    ],
  )

  useEffect(
    () => () => {
      if (pendingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollFrameRef.current)
      }
      if (pendingBottomAlignFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingBottomAlignFrameRef.current)
      }
    },
    [],
  )

  return {
    scheduleXtermBottomAlign,
    scrollTerminalToBottom,
    writeToTerminal,
  }
}
