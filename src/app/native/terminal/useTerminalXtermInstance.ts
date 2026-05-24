import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal as XTerm } from '@xterm/xterm'
import type { RefObject } from 'react'
import { useEffect } from 'react'
import { piGuiThemeUpdatedEvent } from '../../app-shell/usePiGuiTheme'
import { openExternalQuery } from '../../query/desktop-query'
import { buildXtermTheme } from './terminal-xterm-theme'
import {
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  normalizeTerminalDimension,
  writeSystemMessage,
} from './terminalViewportUtils'

type TerminalSize = { cols: number; rows: number }

export function useTerminalXtermInstance({
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
}: {
  fitAddonRef: RefObject<FitAddon | null>
  handleTerminalData: (data: string) => void
  handleTerminalError: (error: unknown) => void
  handleTerminalResize: (cols: number, rows: number) => void
  lastKnownSizeRef: RefObject<TerminalSize>
  scheduleXtermBottomAlign: () => void
  setTerminalInitError: (message: string | null) => void
  setTerminalReadyRevision: (updater: (current: number) => number) => void
  terminalInitialFitTimerRef: RefObject<number | null>
  terminalInstanceRef: RefObject<XTerm | null>
  terminalMountRef: RefObject<HTMLDivElement | null>
  terminalStyle: unknown
  writeToTerminal: (data: string | Uint8Array) => void
}) {
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
          void openExternalQuery(uri).then((opened) => {
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
  }, [terminalInstanceRef, terminalMountRef, terminalStyle])

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
  }, [terminalInstanceRef, terminalMountRef])
}
