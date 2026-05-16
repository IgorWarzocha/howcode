export type ComposerSendMode = 'enter' | 'cmd-enter'

export type KeybindingCommandId =
  | 'app.commandPalette'
  | 'settings.open'
  | 'thread.new'
  | 'thread.find'
  | 'sidebar.toggle'
  | 'terminal.toggle'
  | 'terminal.clear'
  | 'gitops.open'
  | 'gitops.toggleChangedFiles'
  | 'thread.previousInProject'
  | 'thread.nextInProject'
  | 'composer.submit'
  | 'composer.newline'
  | 'agent.interrupt'
  | 'dictation.toggle'

export type KeybindingOverrides = Partial<Record<KeybindingCommandId, string | null>>

export type KeybindingDefinition = {
  id: KeybindingCommandId
  label: string
  defaults: readonly string[]
  reserved?: boolean
}

export const bundledKeybindings: readonly KeybindingDefinition[] = [
  {
    id: 'app.commandPalette',
    label: 'Open command palette',
    defaults: ['CmdOrCtrl+K', 'CmdOrCtrl+Shift+P'],
    reserved: true,
  },
  { id: 'settings.open', label: 'Open settings', defaults: ['CmdOrCtrl+,'] },
  { id: 'thread.new', label: 'New thread', defaults: ['CmdOrCtrl+N'] },
  { id: 'thread.find', label: 'Find in current thread', defaults: ['CmdOrCtrl+F'] },
  { id: 'sidebar.toggle', label: 'Toggle sidebar', defaults: ['CmdOrCtrl+B'] },
  { id: 'terminal.toggle', label: 'Toggle terminal', defaults: ['CmdOrCtrl+J'] },
  { id: 'terminal.clear', label: 'Clear focused terminal', defaults: ['Ctrl+L'] },
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
  { id: 'agent.interrupt', label: 'Interrupt active run', defaults: ['Escape Escape'] },
  { id: 'dictation.toggle', label: 'Toggle dictation', defaults: ['Ctrl+M'] },
]

const knownCommandIds = new Set<KeybindingCommandId>(
  bundledKeybindings.map((binding) => binding.id),
)

export function isKeybindingCommandId(value: unknown): value is KeybindingCommandId {
  return typeof value === 'string' && knownCommandIds.has(value as KeybindingCommandId)
}

export function normalizeAccelerator(value: string) {
  return value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('+')
}

export function getEffectiveAccelerators(overrides: KeybindingOverrides | null | undefined) {
  const result = new Map<KeybindingCommandId, readonly string[]>()
  for (const binding of bundledKeybindings) {
    const override = overrides?.[binding.id]
    if (override === null) result.set(binding.id, [])
    else if (typeof override === 'string' && override.trim())
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
