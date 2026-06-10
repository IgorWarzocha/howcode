import type {
  ExtensionUIContext,
  ExtensionUIDialogOptions,
  ExtensionWidgetOptions,
} from '@earendil-works/pi-coding-agent'
import type {
  PiExtensionDialogRequest,
  PiExtensionShortcut,
  PiExtensionStatus,
  PiExtensionWidget,
} from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from './types.ts'

const styleMarkerOpen = '\u001b]howcode-style;'
const styleMarkerClose = '\u0007'
const styleMarkerReset = `${styleMarkerOpen}reset${styleMarkerClose}`

function wrapStyle(kind: 'bg' | 'bold' | 'fg', name: string, value: string) {
  return `${styleMarkerOpen}${kind}:${name}${styleMarkerClose}${value}${styleMarkerReset}`
}

const plainTheme = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === 'fg') return (name: string, value: string) => wrapStyle('fg', name, value)
      if (property === 'bg') return (name: string, value: string) => wrapStyle('bg', name, value)
      if (property === 'bold') return (value: string) => wrapStyle('bold', 'bold', value)
      return (_name: string, value: string) => value
    },
  },
) as ExtensionUIContext['theme']

const widgetsBySession = new Map<string, Map<string, PiExtensionWidget>>()
const statusesBySession = new Map<string, Map<string, PiExtensionStatus>>()
const dialogsBySession = new Map<string, PendingPiExtensionDialog>()
const editorStatesBySession = new Map<string, PiExtensionEditorState>()

export type PiExtensionEditorState = {
  text: string
  selectionStart: number
  selectionEnd: number
  changed: boolean
}

type PendingPiExtensionDialog = PiExtensionDialogRequest & {
  cleanup: () => void
  resolve: (answer: PiExtensionDialogAnswer) => void
}

type PiExtensionDialogAnswer = {
  cancelled?: boolean | undefined
  confirmed?: boolean | undefined
  value?: string | undefined
}

function getSessionPath(runtime: PiRuntime) {
  return runtime.session.sessionFile ?? null
}

function getSessionWidgets(sessionPath: string) {
  let widgets = widgetsBySession.get(sessionPath)
  if (!widgets) {
    widgets = new Map()
    widgetsBySession.set(sessionPath, widgets)
  }
  return widgets
}

function getSessionStatuses(sessionPath: string) {
  let statuses = statusesBySession.get(sessionPath)
  if (!statuses) {
    statuses = new Map()
    statusesBySession.set(sessionPath, statuses)
  }
  return statuses
}

function stripAnsi(text: string) {
  let output = ''
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== 27 || text[index + 1] !== '[') {
      output += text[index]
      continue
    }
    index += 2
    while (index < text.length) {
      const code = text.charCodeAt(index)
      if (code >= 64 && code <= 126) break
      index += 1
    }
  }
  return output
}

function stripStyleMarkers(text: string) {
  let output = ''
  let cursor = 0
  while (cursor < text.length) {
    const markerStart = text.indexOf(styleMarkerOpen, cursor)
    if (markerStart < 0) return output + text.slice(cursor)
    output += text.slice(cursor, markerStart)
    const markerEnd = text.indexOf(styleMarkerClose, markerStart + styleMarkerOpen.length)
    if (markerEnd < 0) return output + text.slice(markerStart)
    cursor = markerEnd + styleMarkerClose.length
  }
  return output
}

function normalizeWidgetContent(content: unknown) {
  if (content === undefined) return null
  if (Array.isArray(content)) return content.map((line) => String(line))
  if (typeof content === 'string') return content.split('\n')
  return ['Component-based widgets are not yet compatible with Howcode.']
}

export function getPiExtensionWidgets(runtime: PiRuntime): PiExtensionWidget[] {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return []
  return [...(widgetsBySession.get(sessionPath)?.values() ?? [])]
}

export function getPiExtensionStatuses(runtime: PiRuntime): PiExtensionStatus[] {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return []
  return [...(statusesBySession.get(sessionPath)?.values() ?? [])]
}

export function getPiExtensionShortcuts(runtime: PiRuntime): PiExtensionShortcut[] {
  return [...runtime.session.extensionRunner.getShortcuts({} as never).values()].map(
    (shortcut) => ({
      shortcut: String(shortcut.shortcut),
      description: shortcut.description,
      extensionPath: shortcut.extensionPath,
    }),
  )
}

export function getPiExtensionDialog(runtime: PiRuntime): PiExtensionDialogRequest | null {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return null
  const dialog = dialogsBySession.get(sessionPath)
  if (!dialog) return null
  const { cleanup: _cleanup, resolve: _resolve, ...request } = dialog
  return request
}

export function hasPendingPiExtensionDialog(runtime: PiRuntime) {
  const sessionPath = getSessionPath(runtime)
  return Boolean(sessionPath && dialogsBySession.has(sessionPath))
}

export function bindPiExtensionEditorState(runtime: PiRuntime, state: PiExtensionEditorState) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return () => state
  editorStatesBySession.set(sessionPath, state)
  return () => {
    editorStatesBySession.delete(sessionPath)
    return state
  }
}

function getEditorState(runtime: PiRuntime) {
  const sessionPath = getSessionPath(runtime)
  return sessionPath ? editorStatesBySession.get(sessionPath) : undefined
}

export function clearPiExtensionUi(runtime: PiRuntime) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return
  widgetsBySession.delete(sessionPath)
  statusesBySession.delete(sessionPath)
  resolvePendingDialog(sessionPath, { cancelled: true })
}

function resolvePendingDialog(sessionPath: string, answer: PiExtensionDialogAnswer) {
  const dialog = dialogsBySession.get(sessionPath)
  if (!dialog) return false
  dialogsBySession.delete(sessionPath)
  dialog.cleanup()
  dialog.resolve(answer)
  return true
}

export function answerPiExtensionDialog(
  runtime: PiRuntime,
  requestId: string,
  answer: PiExtensionDialogAnswer,
) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return false
  const dialog = dialogsBySession.get(sessionPath)
  if (!dialog || dialog.id !== requestId) return false
  return resolvePendingDialog(sessionPath, answer)
}

function createDialogRequest(
  runtime: PiRuntime,
  request: Omit<PiExtensionDialogRequest, 'id'>,
  onStateChange: () => void,
  options?: ExtensionUIDialogOptions,
) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return Promise.resolve<PiExtensionDialogAnswer>({ cancelled: true })
  if (options?.signal?.aborted) {
    return Promise.resolve<PiExtensionDialogAnswer>({ cancelled: true })
  }
  const id = `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  resolvePendingDialog(sessionPath, { cancelled: true })
  return new Promise<PiExtensionDialogAnswer>((resolve) => {
    const abortDialog = () => {
      resolvePendingDialog(sessionPath, { cancelled: true })
      onStateChange()
    }
    const timeout = options?.timeout ? setTimeout(abortDialog, options.timeout) : undefined
    options?.signal?.addEventListener('abort', abortDialog, { once: true })
    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
      options?.signal?.removeEventListener('abort', abortDialog)
    }
    dialogsBySession.set(sessionPath, { id, ...request, cleanup, resolve })
    onStateChange()
  }).finally(onStateChange)
}

function clampEditorSelection(position: number, text: string) {
  return Math.max(0, Math.min(position, text.length))
}

function replaceEditorSelection(state: PiExtensionEditorState, text: string) {
  const selectionStart = clampEditorSelection(state.selectionStart, state.text)
  const selectionEnd = clampEditorSelection(state.selectionEnd, state.text)
  const start = Math.min(selectionStart, selectionEnd)
  const end = Math.max(selectionStart, selectionEnd)
  const nextText = `${state.text.slice(0, start)}${text}${state.text.slice(end)}`
  const cursorPosition = start + text.length
  state.text = nextText
  state.selectionStart = cursorPosition
  state.selectionEnd = cursorPosition
  state.changed = true
}

export function createPiExtensionUiContext(
  runtime: PiRuntime,
  onStateChange: () => void,
): ExtensionUIContext {
  return {
    select: async (title, options, dialogOptions) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'select', title, options },
        onStateChange,
        dialogOptions,
      )
      return answer.cancelled ? undefined : answer.value
    },
    confirm: async (title, message, dialogOptions) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'confirm', title, message },
        onStateChange,
        dialogOptions,
      )
      return answer.cancelled ? false : answer.confirmed === true
    },
    input: async (title, placeholder, dialogOptions) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'input', title, placeholder },
        onStateChange,
        dialogOptions,
      )
      return answer.cancelled ? undefined : answer.value
    },
    notify: (message, type) => {
      runtime.session.sessionManager.appendCustomMessageEntry('Extension:', message, true, {
        source: 'extension-notify',
        severity: type ?? 'info',
      })
      onStateChange()
    },
    onTerminalInput: () => () => undefined,
    setStatus: (key, text) => {
      const sessionPath = getSessionPath(runtime)
      if (!sessionPath) return
      const statuses = getSessionStatuses(sessionPath)
      const normalizedText =
        text === undefined ? '' : stripStyleMarkers(stripAnsi(String(text))).trim()
      if (normalizedText) statuses.set(key, { key, text: normalizedText })
      else statuses.delete(key)
      onStateChange()
    },
    setWorkingMessage: () => undefined,
    setWorkingVisible: () => undefined,
    setWorkingIndicator: () => undefined,
    setHiddenThinkingLabel: () => undefined,
    setWidget: (key: string, content: unknown, options?: ExtensionWidgetOptions) => {
      const sessionPath = getSessionPath(runtime)
      if (!sessionPath) return
      const widgets = getSessionWidgets(sessionPath)
      const lines = normalizeWidgetContent(content)
      if (lines) widgets.set(key, { key, lines, placement: options?.placement })
      else widgets.delete(key)
      onStateChange()
    },
    setFooter: () => undefined,
    setHeader: () => undefined,
    setTitle: () => undefined,
    custom: async () => undefined as never,
    pasteToEditor: (text) => {
      const state = getEditorState(runtime)
      if (state) replaceEditorSelection(state, String(text))
    },
    setEditorText: (text) => {
      const state = getEditorState(runtime)
      if (!state) return
      state.text = String(text)
      state.selectionStart = state.text.length
      state.selectionEnd = state.text.length
      state.changed = true
    },
    getEditorText: () => getEditorState(runtime)?.text ?? '',
    editor: async (title, prefill) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'editor', title, prefill },
        onStateChange,
      )
      return answer.cancelled ? undefined : answer.value
    },
    addAutocompleteProvider: () => undefined,
    setEditorComponent: () => undefined,
    getEditorComponent: () => undefined,
    get theme() {
      return plainTheme
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: 'Theme switching is not available in Howcode.' }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => undefined,
  }
}
