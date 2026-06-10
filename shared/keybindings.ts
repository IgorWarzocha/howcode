export type ComposerSendMode = 'enter' | 'cmd-enter'

export type KeybindingCommandId =
  | 'app.commandPalette'
  | 'settings.open'
  | 'thread.new'
  | 'thread.find'
  | 'sidebar.find'
  | 'sidebar.toggle'
  | 'terminal.toggle'
  | 'terminal.focus'
  | 'terminal.clear'
  | 'gitops.open'
  | 'gitops.toggleChangedFiles'
  | 'thread.previousInProject'
  | 'thread.nextInProject'
  | 'composer.submit'
  | 'composer.newline'
  | 'composer.focus'
  | 'agent.interrupt'
  | 'dictation.toggle'

export type KeybindingOverrides = Partial<Record<KeybindingCommandId, string | null>>
export type KeybindingMode = 'desktop' | 'pi-tui'
export type KeybindingScope = 'desktop' | 'global' | 'pi-tui'

export type KeybindingDefinition = {
  id: KeybindingCommandId
  label: string
  defaults: readonly string[]
  reserved?: boolean
  scope?: KeybindingScope | readonly KeybindingScope[]
}

export const bundledKeybindings: readonly KeybindingDefinition[] = [
  {
    id: 'app.commandPalette',
    label: 'Open command palette',
    defaults: ['CmdOrCtrl+K', 'CmdOrCtrl+Shift+P'],
    reserved: true,
    scope: 'global',
  },
  { id: 'settings.open', label: 'Open settings', defaults: ['CmdOrCtrl+,'], scope: 'global' },
  { id: 'thread.new', label: 'New thread', defaults: ['CmdOrCtrl+N'] },
  { id: 'thread.find', label: 'Find in current thread', defaults: ['CmdOrCtrl+F'] },
  { id: 'sidebar.find', label: 'Find in sidebar', defaults: ['CmdOrCtrl+Shift+F'] },
  { id: 'sidebar.toggle', label: 'Toggle sidebar', defaults: ['CmdOrCtrl+B'], scope: 'global' },
  { id: 'terminal.toggle', label: 'Toggle terminal', defaults: ['CmdOrCtrl+J'] },
  { id: 'terminal.focus', label: 'Open and focus terminal', defaults: ['Ctrl+Shift+/'] },
  { id: 'terminal.clear', label: 'Clear terminal', defaults: ['Ctrl+L'] },
  { id: 'gitops.open', label: 'Open GitOps', defaults: ['CmdOrCtrl+G'] },
  {
    id: 'gitops.toggleChangedFiles',
    label: 'Toggle changed files',
    defaults: ['CmdOrCtrl+Shift+G'],
  },
  {
    id: 'thread.previousInProject',
    label: 'Previous thread in current project',
    defaults: ['CmdOrCtrl+Shift+['],
  },
  {
    id: 'thread.nextInProject',
    label: 'Next thread in current project',
    defaults: ['CmdOrCtrl+Shift+]'],
  },
  { id: 'composer.submit', label: 'Submit prompt', defaults: ['Enter'] },
  { id: 'composer.newline', label: 'Insert newline', defaults: ['Shift+Enter'] },
  { id: 'composer.focus', label: 'Focus prompt', defaults: ['Ctrl+/'] },
  { id: 'agent.interrupt', label: 'Interrupt active run', defaults: ['Escape Escape'] },
  { id: 'dictation.toggle', label: 'Toggle dictation', defaults: ['Ctrl+M'] },
]

const knownCommandIds = new Set<KeybindingCommandId>(
  bundledKeybindings.map((binding) => binding.id),
)
const bundledKeybindingsById = new Map(bundledKeybindings.map((binding) => [binding.id, binding]))

export function isKeybindingCommandId(value: unknown): value is KeybindingCommandId {
  return typeof value === 'string' && knownCommandIds.has(value as KeybindingCommandId)
}

export function getKeybindingScopes(commandId: KeybindingCommandId): readonly KeybindingScope[] {
  const scope = bundledKeybindingsById.get(commandId)?.scope ?? 'desktop'
  return typeof scope === 'string' ? [scope] : scope
}

export function keybindingCommandIsActiveInMode(
  commandId: KeybindingCommandId,
  mode: KeybindingMode,
) {
  const scopes = getKeybindingScopes(commandId)
  return scopes.includes('global') || scopes.includes(mode)
}

const modifierAliasMap = new Map([
  ['Command', 'Cmd'],
  ['Meta', 'Cmd'],
  ['Control', 'Ctrl'],
  ['Option', 'Alt'],
])
const modifierOrder = new Map([
  ['CmdOrCtrl', 0],
  ['Cmd', 1],
  ['Ctrl', 2],
  ['Alt', 3],
  ['Shift', 4],
])
const acceleratorSequenceSeparatorPattern = /\s+/

function normalizeAcceleratorChord(chord: string) {
  const parts = chord
    .split('+')
    .map((part) => modifierAliasMap.get(part.trim()) ?? part.trim())
    .filter(Boolean)
  const key = parts.at(-1)
  if (!key) return ''
  const modifiers = parts
    .slice(0, -1)
    .sort((left, right) => (modifierOrder.get(left) ?? 99) - (modifierOrder.get(right) ?? 99))
  return [...modifiers, key].join('+')
}

export function normalizeAccelerator(value: string) {
  return value
    .trim()
    .split(acceleratorSequenceSeparatorPattern)
    .filter(Boolean)
    .map(normalizeAcceleratorChord)
    .join(' ')
}

const modifierNames = new Set([
  'CmdOrCtrl',
  'Cmd',
  'Command',
  'Meta',
  'Ctrl',
  'Control',
  'Alt',
  'Option',
  'Shift',
])

export function isValidAccelerator(value: string) {
  const normalizedAccelerator = normalizeAccelerator(value)
  const sequenceParts = normalizedAccelerator
    .split(acceleratorSequenceSeparatorPattern)
    .filter(Boolean)
  if (sequenceParts.length === 0) return false
  if (sequenceParts.length > 1) return normalizedAccelerator === 'Escape Escape'

  for (const sequencePart of sequenceParts) {
    const parts = sequencePart.split('+')
    const key = parts.at(-1)?.trim()
    if (!key || modifierNames.has(key)) return false
    const modifiers = parts.slice(0, -1)
    if (modifiers.some((modifier) => !modifierNames.has(modifier.trim()))) return false
  }

  return true
}

const keyboardCodeLetterPattern = /^Key[A-Z]$/
const keyboardCodeDigitPattern = /^Digit\d$/
const keyboardCodePunctuationMap = new Map([
  ['Backquote', '`'],
  ['Minus', '-'],
  ['Equal', '='],
  ['BracketLeft', '['],
  ['BracketRight', ']'],
  ['Backslash', '\\'],
  ['Semicolon', ';'],
  ['Quote', "'"],
  ['Comma', ','],
  ['Period', '.'],
  ['Slash', '/'],
  ['IntlBackslash', '\\'],
  ['IntlRo', '\\'],
  ['IntlYen', '¥'],
])

export type KeybindingKeyboardEventLike = {
  altKey: boolean
  code: string
  ctrlKey: boolean
  key: string
  metaKey: boolean
  shiftKey: boolean
}

export function getKeybindingEventKey(event: Pick<KeybindingKeyboardEventLike, 'code' | 'key'>) {
  if (keyboardCodeLetterPattern.test(event.code)) return event.code.slice(3)
  if (keyboardCodeDigitPattern.test(event.code)) return event.code.slice(5)
  const punctuationKey = keyboardCodePunctuationMap.get(event.code)
  if (punctuationKey) return punctuationKey
  if (event.key === ' ') return 'Space'
  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

export function eventToAcceleratorCandidates(event: KeybindingKeyboardEventLike) {
  const parts: string[] = []
  const exactParts: string[] = []
  if (event.metaKey) exactParts.push('Cmd')
  if (event.ctrlKey) exactParts.push('Ctrl')
  if (event.metaKey || event.ctrlKey) parts.push('CmdOrCtrl')
  if (event.altKey) parts.push('Alt')
  if (event.altKey) exactParts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.shiftKey) exactParts.push('Shift')
  const key = getKeybindingEventKey(event)
  parts.push(key)
  exactParts.push(key)
  return [...new Set([exactParts.join('+'), parts.join('+')])]
}

export function getEffectiveAccelerators(overrides: KeybindingOverrides | null | undefined) {
  const result = new Map<KeybindingCommandId, readonly string[]>()
  for (const binding of bundledKeybindings) {
    const override = overrides?.[binding.id]
    if (override === null) result.set(binding.id, [])
    else if (typeof override === 'string' && isValidAccelerator(override))
      result.set(binding.id, [normalizeAccelerator(override)])
    else result.set(binding.id, binding.defaults)
  }
  return result
}

export type KeybindingConflict = {
  accelerator: string
  commandIds: KeybindingCommandId[]
}

export function getKeybindingConflicts(overrides: KeybindingOverrides | null | undefined) {
  const acceleratorCommands = new Map<string, KeybindingCommandId[]>()
  for (const [commandId, accelerators] of getEffectiveAccelerators(overrides)) {
    for (const accelerator of accelerators) {
      const normalizedAccelerator = normalizeAccelerator(accelerator)
      if (!normalizedAccelerator || normalizedAccelerator.includes(' ')) continue
      acceleratorCommands.set(normalizedAccelerator, [
        ...(acceleratorCommands.get(normalizedAccelerator) ?? []),
        commandId,
      ])
    }
  }

  return [...acceleratorCommands.entries()]
    .filter(([, conflictingCommandIds]) => conflictingCommandIds.length > 1)
    .map(([accelerator, conflictingCommandIds]) => ({
      accelerator,
      commandIds: conflictingCommandIds,
    }))
}

export function getConflictForCommand(
  commandId: KeybindingCommandId,
  overrides: KeybindingOverrides | null | undefined,
) {
  return getKeybindingConflicts(overrides).find((conflict) =>
    conflict.commandIds.includes(commandId),
  )
}
