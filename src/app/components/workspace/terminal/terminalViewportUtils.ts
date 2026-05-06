const ansiControlSequencePattern = /^\[[0-?]*[ -/]*[@-~]/

import type { CSSProperties } from 'react'

export type TerminalBackgroundCssVar = '--terminal-bg' | '--workspace' | '--sidebar'

export const MAX_PENDING_TERMINAL_EVENTS = 200
export const DEFAULT_TERMINAL_COLS = 80
export const DEFAULT_TERMINAL_ROWS = 24
export const MIN_INITIAL_TERMINAL_COLS = 20
export const MIN_INITIAL_TERMINAL_ROWS = 5
export const DEFAULT_MAX_KEEP_ALIVE_MS_ON_UNMOUNT = 12 * 60 * 60 * 1_000

const CLEAR_TERMINAL_SEQUENCE = '\u001b[2J\u001b[3J\u001b[H'
const MAX_FRONTEND_HISTORY_CHARS = 200_000
const TRIMMED_FRONTEND_HISTORY_CHARS = 160_000
const MIN_USABLE_TERMINAL_COLS = 2
const MIN_USABLE_TERMINAL_ROWS = 2
const TERMINAL_STICKY_BOTTOM_THRESHOLD_PX = 24
const ANSI_ESCAPE = String.fromCharCode(27)

export function hasVisibleTerminalHistory(history: string) {
  return (
    history
      .split(ANSI_ESCAPE)
      .map((segment, index) =>
        index === 0 ? segment : segment.replace(ansiControlSequencePattern, ''),
      )
      .join('')
      .trim().length > 0
  )
}

export function writeSystemMessage(write: (data: string) => void, message: string) {
  write(`\r\n[terminal] ${message}\r\n`)
}

export function clearTerminal(write: (data: string) => void) {
  write(CLEAR_TERMINAL_SEQUENCE)
}

export function clampTerminalHistory(history: string) {
  return history.length > MAX_FRONTEND_HISTORY_CHARS
    ? history.slice(-TRIMMED_FRONTEND_HISTORY_CHARS)
    : history
}

export function normalizeTerminalDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

export function isUsableTerminalSize(cols: number, rows: number) {
  return cols >= MIN_USABLE_TERMINAL_COLS && rows >= MIN_USABLE_TERMINAL_ROWS
}

export function terminalWrapperStyle(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    '--terminal-surface': `var(${backgroundCssVar})`,
  } as CSSProperties
}

export function terminalStyleVars(backgroundCssVar: TerminalBackgroundCssVar): CSSProperties {
  return {
    '--terminal-selection': 'rgba(185, 191, 243, 0.18)',
    '--term-bg': `var(${backgroundCssVar})`,
    '--term-fg': 'var(--text)',
    '--term-cursor': 'var(--accent)',
    '--term-font-family': '"Liberation Mono", Consolas, Menlo, monospace',
    '--term-font-size': '12px',
    '--term-line-height': '1.2',
    '--term-color-0': `var(${backgroundCssVar})`,
    '--term-color-1': '#db7d84',
    '--term-color-2': 'var(--green)',
    '--term-color-3': 'var(--accent)',
    '--term-color-4': 'var(--accent)',
    '--term-color-5': 'var(--accent)',
    '--term-color-6': 'var(--muted)',
    '--term-color-7': 'var(--text)',
    '--term-color-8': 'var(--muted-2)',
    '--term-color-9': '#ec979d',
    '--term-color-10': 'var(--green)',
    '--term-color-11': 'var(--text)',
    '--term-color-12': 'var(--text)',
    '--term-color-13': 'var(--text)',
    '--term-color-14': 'var(--text)',
    '--term-color-15': '#f7f9ff',
  } as CSSProperties
}

export function isTerminalElementNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.clientHeight - element.scrollTop <=
    TERMINAL_STICKY_BOTTOM_THRESHOLD_PX
  )
}
