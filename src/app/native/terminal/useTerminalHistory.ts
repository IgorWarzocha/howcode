import type { Terminal as XTerm } from '@xterm/xterm'
import { type RefObject, useCallback, useRef } from 'react'
import { clampTerminalHistory, clearTerminal } from './terminalViewportUtils'

export function useTerminalHistory({
  scheduleXtermBottomAlign,
  terminalInstanceRef,
  writeToTerminal,
}: {
  scheduleXtermBottomAlign: () => void
  terminalInstanceRef: RefObject<XTerm | null>
  writeToTerminal: (data: string | Uint8Array) => void
}) {
  const terminalHistoryRef = useRef('')

  const resetTerminal = useCallback(
    (history = '') => {
      const nextHistory = clampTerminalHistory(history)
      terminalHistoryRef.current = nextHistory
      if (nextHistory) clearTerminal((data) => writeToTerminal(data))
      else terminalInstanceRef.current?.clear()
      if (nextHistory) writeToTerminal(nextHistory)
      scheduleXtermBottomAlign()
    },
    [scheduleXtermBottomAlign, terminalInstanceRef, writeToTerminal],
  )

  const appendTerminalHistory = useCallback(
    (chunk: string) => {
      const nextHistory = clampTerminalHistory(terminalHistoryRef.current + chunk)
      const trimmed = nextHistory.length !== terminalHistoryRef.current.length + chunk.length
      terminalHistoryRef.current = nextHistory

      if (trimmed) {
        clearTerminal((data) => writeToTerminal(data))
        if (nextHistory) writeToTerminal(nextHistory)
        return
      }

      writeToTerminal(chunk)
    },
    [writeToTerminal],
  )

  return { appendTerminalHistory, resetTerminal, terminalHistoryRef }
}
