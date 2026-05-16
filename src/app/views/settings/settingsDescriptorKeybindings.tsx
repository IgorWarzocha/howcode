import {
  bundledKeybindings,
  getConflictForCommand,
  getEffectiveAccelerators,
  normalizeAccelerator,
} from '../../../../shared/keybindings'
import type { AppSettings, DesktopActionInvoker, KeybindingCommandId } from '../../desktop/types'
import { composerTextActionButtonClass, settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect } from './settingsUi'

function getKeybindingValue(appSettings: AppSettings, commandId: KeybindingCommandId) {
  const override = appSettings.keybindings[commandId]
  if (override === null) return ''
  if (typeof override === 'string') return override
  return getEffectiveAccelerators(appSettings.keybindings).get(commandId)?.join(', ') ?? ''
}

function updateKeybinding(input: {
  appSettings: AppSettings
  commandId: KeybindingCommandId
  value: string | null
  onAction: DesktopActionInvoker
}) {
  const nextKeybindings = { ...input.appSettings.keybindings }
  if (input.value === null) nextKeybindings[input.commandId] = null
  else {
    const normalized = normalizeAccelerator(input.value)
    if (normalized) nextKeybindings[input.commandId] = normalized
    else delete nextKeybindings[input.commandId]
  }
  void input.onAction('settings.update', { key: 'keybindings', value: nextKeybindings })
}

function resetKeybinding(input: {
  appSettings: AppSettings
  commandId: KeybindingCommandId
  onAction: DesktopActionInvoker
}) {
  const nextKeybindings = { ...input.appSettings.keybindings }
  delete nextKeybindings[input.commandId]
  void input.onAction('settings.update', { key: 'keybindings', value: nextKeybindings })
}

function KeybindingRow({
  appSettings,
  commandId,
  onAction,
}: {
  appSettings: AppSettings
  commandId: KeybindingCommandId
  onAction: DesktopActionInvoker
}) {
  const binding = bundledKeybindings.find((item) => item.id === commandId)
  const conflict = getConflictForCommand(commandId, appSettings.keybindings)
  const disabled = appSettings.keybindings[commandId] === null
  return (
    <div className="grid min-w-0 gap-1 rounded-xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(10rem,16rem)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="truncate text-[12px] text-[color:var(--text)]">
          {binding?.label ?? commandId}
        </div>
        <div className="truncate font-mono text-[11px] text-[color:var(--muted)]">{commandId}</div>
      </div>
      <input
        className={cn(settingsInputClass, conflict && 'border-[color:var(--warning)]')}
        value={getKeybindingValue(appSettings, commandId)}
        placeholder={binding?.defaults.join(', ') ?? 'Unbound'}
        onChange={(event) =>
          updateKeybinding({
            appSettings,
            commandId,
            value: event.currentTarget.value,
            onAction,
          })
        }
        aria-label={`${binding?.label ?? commandId} shortcut`}
      />
      <div className="flex items-center justify-end gap-1">
        {conflict ? (
          <span className="mr-1 truncate text-[11px] text-[color:var(--warning)]">
            Conflicts with {conflict.commandIds.filter((id) => id !== commandId).join(', ')}
          </span>
        ) : null}
        <button
          type="button"
          className={composerTextActionButtonClass}
          onClick={() =>
            disabled
              ? resetKeybinding({ appSettings, commandId, onAction })
              : updateKeybinding({ appSettings, commandId, value: null, onAction })
          }
        >
          {disabled ? 'Enable' : 'Disable'}
        </button>
        <button
          type="button"
          className={composerTextActionButtonClass}
          onClick={() => resetKeybinding({ appSettings, commandId, onAction })}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export function buildKeybindingSettingsDescriptors({
  appSettings,
  openSelectId,
  setOpenSelectId,
  onAction,
}: {
  appSettings: AppSettings
  openSelectId: string | null
  setOpenSelectId: (value: string | null) => void
  onAction: DesktopActionInvoker
}): SettingDescriptor[] {
  return [
    {
      id: 'keybindings.composer-send-mode',
      category: 'keybindings',
      title: 'Composer send mode',
      description: 'Choose whether Enter sends or inserts a newline.',
      keywords: 'keyboard shortcut keybinding enter composer send newline cmd ctrl',
      render: () => (
        <InlineSelect
          id="settings-composer-send-mode"
          value={appSettings.composerSendMode}
          open={openSelectId === 'settings-composer-send-mode'}
          onOpenChange={(open) => setOpenSelectId(open ? 'settings-composer-send-mode' : null)}
          onChange={(value) =>
            void onAction('settings.update', {
              key: 'composerSendMode',
              value: value === 'cmd-enter' ? 'cmd-enter' : 'enter',
            })
          }
          options={[
            { value: 'enter', label: 'Enter sends', description: 'Shift+Enter inserts newline' },
            {
              value: 'cmd-enter',
              label: 'Cmd/Ctrl+Enter sends',
              description: 'Enter inserts newline',
            },
          ]}
        />
      ),
    },
    {
      id: 'keybindings.bindings',
      category: 'keybindings',
      title: 'Shortcuts',
      description: 'Bundled shortcuts with user overrides. Empty value restores the default.',
      keywords: 'keyboard shortcut keybinding hotkey accelerator conflicts disable reset',
      render: () => (
        <div className="grid w-full min-w-[min(42rem,100%)] gap-2">
          {bundledKeybindings.map((binding) => (
            <KeybindingRow
              key={binding.id}
              appSettings={appSettings}
              commandId={binding.id}
              onAction={onAction}
            />
          ))}
        </div>
      ),
    },
  ]
}
