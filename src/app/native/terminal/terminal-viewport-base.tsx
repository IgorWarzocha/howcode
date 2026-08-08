import { appToneTextClass, appTypeSmallClass } from '@howcode/ui'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useHowcodeKeybindingCommand } from '../../app-shell/keybinding-events'
import { writeDesktopTerminal } from '../../hooks/useDesktopTerminal'
import { useHoverToFocus } from '../../hooks/useHoverToFocus'
import { cn } from '../../utils/cn'
import {
  getTerminalPersistedSessionPath,
  type TerminalSessionPolicy,
} from './terminal-session-policy'
import {
  type TerminalBackgroundCssVar,
  terminalStyleVars,
  terminalWrapperStyle,
  writeSystemMessage,
} from './terminalViewportUtils'
import { useTerminalHistory } from './useTerminalHistory'
import { useTerminalOutputBehavior } from './useTerminalOutputBehavior'
import { useTerminalResize } from './useTerminalResize'
import { useTerminalSessionLifecycle } from './useTerminalSessionLifecycle'
import { useTerminalXtermInstance } from './useTerminalXtermInstance'

type SharedTerminalViewportProps = {
  projectId: string
  sessionPath: string | null
  backgroundCssVar: TerminalBackgroundCssVar
  className?: string
}

type TerminalViewportBaseProps = SharedTerminalViewportProps &
  (
    | { mode: 'shell'; hoverToFocus: boolean; hoverToBlur: boolean }
    | {
        mode: 'pi-session'
        keepAliveMsOnUnmount: number
        closeWhenSessionFileIdleMs: number
        maxKeepAliveMsOnUnmount: number
      }
  )

export function TerminalViewportBase(props: TerminalViewportBaseProps) {
  const { projectId, sessionPath, backgroundCssVar, className } = props
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const terminalMountRef = useRef<HTMLDivElement | null>(null)
  const terminalInstanceRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalInitialFitTimerRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const initialPiSessionPathRef = useRef(
    props.mode === 'pi-session' ? { value: sessionPath } : null,
  )
  const [terminalReadyRevision, setTerminalReadyRevision] = useState(0)
  const [terminalInitError, setTerminalInitError] = useState<string | null>(null)
  const isShell = props.mode === 'shell'
  const closeWhenSessionFileIdleMs = isShell ? 0 : props.closeWhenSessionFileIdleMs
  const keepAliveMsOnUnmount = isShell ? 0 : props.keepAliveMsOnUnmount
  const maxKeepAliveMsOnUnmount = isShell ? 0 : props.maxKeepAliveMsOnUnmount
  const terminalSessionPath = isShell ? sessionPath : initialPiSessionPathRef.current?.value
  const terminalPersistedSessionPath = getTerminalPersistedSessionPath({
    launchMode: props.mode,
    sessionPath,
    terminalSessionPath,
  })
  const viewportStyle = useMemo(() => terminalWrapperStyle(backgroundCssVar), [backgroundCssVar])
  const terminalStyle = useMemo(() => terminalStyleVars(backgroundCssVar), [backgroundCssVar])

  const focusTerminal = useCallback(() => terminalInstanceRef.current?.focus(), [])
  const blurTerminal = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])
  const isTerminalFocused = useCallback(() => {
    const terminalElement = terminalInstanceRef.current?.element
    const activeElement = document.activeElement
    return !!terminalElement && !!activeElement && terminalElement.contains(activeElement)
  }, [])
  const handleHoverToFocus = useHoverToFocus({
    enabled: isShell ? props.hoverToFocus : false,
    boundaryRef: viewportRef,
    focus: focusTerminal,
    blur: blurTerminal,
    blurOnLeave: isShell ? props.hoverToBlur : false,
    isFocused: isTerminalFocused,
  })

  const bottomAlignInitialContent = isShell
  const stickToBottomOnOutput = isShell
  const { scheduleXtermBottomAlign, writeToTerminal } = useTerminalOutputBehavior({
    bottomAlignInitialContent,
    stickToBottomOnOutput,
    terminalInstanceRef,
  })
  const { appendTerminalHistory, resetTerminal, terminalHistoryRef } = useTerminalHistory({
    scheduleXtermBottomAlign,
    terminalInstanceRef,
    writeToTerminal,
  })

  useHowcodeKeybindingCommand('terminal.clear', (event) => {
    if (!(isShell && isTerminalFocused())) return
    event.preventDefault()
    resetTerminal()
  })
  useHowcodeKeybindingCommand('terminal.focus', (event) => {
    if (!isShell) return
    event.preventDefault()
    focusTerminal()
  })

  const handleTerminalError = useCallback((error: unknown) => {
    setTerminalInitError(error instanceof Error ? error.message : 'Unable to initialize terminal.')
  }, [])
  const handleTerminalData = useCallback(
    (data: string) => {
      const sessionId = sessionIdRef.current
      if (!sessionId) return
      void writeDesktopTerminal(sessionId, data).catch((error) => {
        writeSystemMessage(
          (message) => writeToTerminal(message),
          error instanceof Error ? error.message : 'Terminal write failed.',
        )
      })
    },
    [writeToTerminal],
  )

  const {
    getCurrentTerminalSize,
    handleTerminalResize,
    lastKnownSizeRef,
    lastSentSizeRef,
    scheduleTerminalResizeSettlingPasses,
  } = useTerminalResize({
    fitAddonRef,
    scheduleXtermBottomAlign,
    sessionIdRef,
    stickToBottomOnOutput,
    terminalInstanceRef,
    terminalReadyRevision,
    viewportRef,
  })
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

  const sessionPolicy = useMemo<TerminalSessionPolicy>(
    () =>
      isShell
        ? { kind: 'shell' }
        : {
            kind: 'pi-session',
            closeWhenSessionFileIdleMs,
            keepAliveMsOnUnmount,
            maxKeepAliveMsOnUnmount,
          },
    [closeWhenSessionFileIdleMs, isShell, keepAliveMsOnUnmount, maxKeepAliveMsOnUnmount],
  )
  const terminalSessionLifecycle = useMemo(
    () => ({
      appendTerminalHistory,
      focusTerminal,
      getCurrentSize: getCurrentTerminalSize,
      handleTerminalResize,
      lastSentSizeRef,
      policy: sessionPolicy,
      projectId,
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
      focusTerminal,
      getCurrentTerminalSize,
      handleTerminalResize,
      lastSentSizeRef,
      projectId,
      resetTerminal,
      scheduleTerminalResizeSettlingPasses,
      scheduleXtermBottomAlign,
      sessionPolicy,
      terminalHistoryRef,
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
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex items-start bg-[color:var(--terminal-surface)]/92 px-4 py-3',
            appTypeSmallClass,
            appToneTextClass,
          )}
        >
          <span>[terminal] {terminalInitError}</span>
        </div>
      ) : null}
    </div>
  )
}

export type { SharedTerminalViewportProps }
