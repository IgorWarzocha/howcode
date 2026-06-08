import type { ExtensionUIContext, ExtensionWidgetOptions } from '@earendil-works/pi-coding-agent'
import type {
  NativeExtensionDialogRequest,
  NativeExtensionWidget,
} from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from './types.ts'

const plainTheme = new Proxy(
  {},
  {
    get: () => (_name: string, value: string) => value,
  },
) as ExtensionUIContext['theme']

const widgetsBySession = new Map<string, Map<string, NativeExtensionWidget>>()
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
    notify: () => undefined,
    onTerminalInput: () => () => undefined,
    setStatus: () => undefined,
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
