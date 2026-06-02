import type { ExtensionUIContext, ExtensionWidgetOptions } from '@earendil-works/pi-coding-agent'
import type { NativeExtensionWidget } from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from './types.ts'

const plainTheme = new Proxy(
  {},
  {
    get: () => (_name: string, value: string) => value,
  },
) as ExtensionUIContext['theme']

const widgetsBySession = new Map<string, Map<string, NativeExtensionWidget>>()

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

export function clearNativeExtensionUi(runtime: PiRuntime) {
  const sessionPath = getSessionPath(runtime)
  if (sessionPath) widgetsBySession.delete(sessionPath)
}

export function createNativeExtensionUiContext(
  runtime: PiRuntime,
  onStateChange: () => void,
): ExtensionUIContext {
  return {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
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
    editor: async () => undefined,
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
