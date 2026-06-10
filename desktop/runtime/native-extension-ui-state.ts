import type { ExtensionUIContext, ExtensionWidgetOptions } from '@earendil-works/pi-coding-agent'
import type {
  NativeExtensionDialogRequest,
  NativeExtensionShortcut,
  NativeExtensionStatus,
  NativeExtensionWidget,
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

const widgetsBySession = new Map<string, Map<string, NativeExtensionWidget>>()
const statusesBySession = new Map<string, Map<string, NativeExtensionStatus>>()
const dialogsBySession = new Map<string, PendingNativeExtensionDialog>()

type PendingNativeExtensionDialog = NativeExtensionDialogRequest & {
  resolve: (answer: NativeExtensionDialogAnswer) => void
}

type NativeExtensionDialogAnswer = {
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
  return [String(content)]
}

export function getNativeExtensionWidgets(runtime: PiRuntime): NativeExtensionWidget[] {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return []
  return [...(widgetsBySession.get(sessionPath)?.values() ?? [])]
}

export function getNativeExtensionStatuses(runtime: PiRuntime): NativeExtensionStatus[] {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return []
  return [...(statusesBySession.get(sessionPath)?.values() ?? [])]
}

export function getNativeExtensionShortcuts(runtime: PiRuntime): NativeExtensionShortcut[] {
  return [...runtime.session.extensionRunner.getShortcuts({} as never).values()].map(
    (shortcut) => ({
      shortcut: String(shortcut.shortcut),
      description: shortcut.description,
      extensionPath: shortcut.extensionPath,
    }),
  )
}

export function getNativeExtensionDialog(runtime: PiRuntime): NativeExtensionDialogRequest | null {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return null
  const dialog = dialogsBySession.get(sessionPath)
  if (!dialog) return null
  const { resolve: _resolve, ...request } = dialog
  return request
}

export function clearNativeExtensionUi(runtime: PiRuntime) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return
  widgetsBySession.delete(sessionPath)
  statusesBySession.delete(sessionPath)
  dialogsBySession.get(sessionPath)?.resolve({ cancelled: true })
  dialogsBySession.delete(sessionPath)
}

export function answerNativeExtensionDialog(
  runtime: PiRuntime,
  requestId: string,
  answer: NativeExtensionDialogAnswer,
) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return false
  const dialog = dialogsBySession.get(sessionPath)
  if (!dialog || dialog.id !== requestId) return false
  dialogsBySession.delete(sessionPath)
  dialog.resolve(answer)
  return true
}

function createDialogRequest(
  runtime: PiRuntime,
  request: Omit<NativeExtensionDialogRequest, 'id'>,
  onStateChange: () => void,
) {
  const sessionPath = getSessionPath(runtime)
  if (!sessionPath) return Promise.resolve<NativeExtensionDialogAnswer>({ cancelled: true })
  const id = `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  dialogsBySession.get(sessionPath)?.resolve({ cancelled: true })
  return new Promise<NativeExtensionDialogAnswer>((resolve) => {
    dialogsBySession.set(sessionPath, { id, ...request, resolve })
    onStateChange()
  }).finally(onStateChange)
}

export function createNativeExtensionUiContext(
  runtime: PiRuntime,
  onStateChange: () => void,
): ExtensionUIContext {
  return {
    select: async (title, options) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'select', title, options },
        onStateChange,
      )
      return answer.cancelled ? undefined : answer.value
    },
    confirm: async (title, message) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'confirm', title, message },
        onStateChange,
      )
      return answer.cancelled ? false : answer.confirmed === true
    },
    input: async (title, placeholder) => {
      const answer = await createDialogRequest(
        runtime,
        { method: 'input', title, placeholder },
        onStateChange,
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
    pasteToEditor: () => undefined,
    setEditorText: () => undefined,
    getEditorText: () => '',
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
