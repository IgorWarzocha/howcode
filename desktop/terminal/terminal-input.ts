import { rmSync } from 'node:fs'
import { nowIso } from './session-history.ts'
import type { TerminalSessionRecord } from './session-record.ts'
import type { TerminalSessionStore } from './session-store.ts'
import { rememberSubmittedPrompts, scheduleTuiSessionDetection } from './tui-session-detection.ts'

function applyToBuffer(buffer: string, data: string) {
  let nextBuffer = buffer
  const submittedLines: string[] = []

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      submittedLines.push(nextBuffer)
      nextBuffer = ''
    } else if (char === '\u0003' || char === '\u0015') {
      nextBuffer = ''
    } else if (char === '\b' || char === '\u007f') {
      nextBuffer = nextBuffer.slice(0, -1)
    } else if (char >= ' ') {
      nextBuffer += char
    }
  }

  return { nextBuffer, submittedLines }
}

function markVisible(store: TerminalSessionStore, record: TerminalSessionRecord) {
  if (record.snapshot.hasVisibleContent) return
  record.snapshot = {
    ...record.snapshot,
    hasVisibleContent: true,
    updatedAt: nowIso(),
  }
  store.emit({
    type: 'updated',
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  })
}

export function rememberTerminalInput(
  store: TerminalSessionStore,
  record: TerminalSessionRecord,
  data: string,
) {
  const input = applyToBuffer(record.inputBuffer, data)
  record.inputBuffer = input.nextBuffer
  if (input.submittedLines.some((line) => line.trim() && line.trim() !== 'clear')) {
    rememberSubmittedPrompts(record, input.submittedLines)
    record.suppressOutputVisibilityUntilInput = false
    markVisible(store, record)
    scheduleTuiSessionDetection(store, record)
  }
  return input
}

export function didSubmitClear(input: ReturnType<typeof applyToBuffer>) {
  return input.submittedLines.some((line) => line.trim() === 'clear')
}

export function clearTerminalHistory(store: TerminalSessionStore, record: TerminalSessionRecord) {
  if (record.persistTimer) {
    clearTimeout(record.persistTimer)
    record.persistTimer = null
  }
  record.snapshot = {
    ...record.snapshot,
    history: '',
    hasVisibleContent: false,
    updatedAt: nowIso(),
  }
  record.suppressOutputVisibilityUntilInput = true
  rmSync(record.transcriptPath, { force: true })
  store.emit({
    type: 'cleared',
    sessionId: record.snapshot.sessionId,
    snapshot: record.snapshot,
    createdAt: nowIso(),
  })
}
