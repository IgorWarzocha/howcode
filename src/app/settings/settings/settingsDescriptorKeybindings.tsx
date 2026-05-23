import { Ban, CheckCircle2, RotateCcw } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useState } from 'react'
import {
  bundledKeybindings,
  eventToAcceleratorCandidates,
  getConflictForCommand,
  isValidAccelerator,
  normalizeAccelerator,
} from '../../../../shared/keybindings'
import type { AppSettings, DesktopActionInvoker, KeybindingCommandId } from '../../desktop/types'
import {
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  compactIconButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingDescriptor } from './settingsTypes'
import { InlineSelect } from './settingsUi'

type Platform = 'mac' | 'windows' | 'linux'

const commandHelp: Record<KeybindingCommandId, string> = {
  'app.commandPalette': 'Open the command palette.',
  'settings.open': 'Open settings. Press again to return to the previous view.',
  'thread.new': 'Create a new thread in the current project.',
  'thread.find': 'Find in the current thread.',
  'sidebar.find': 'Focus sidebar search.',
  'sidebar.toggle': 'Show or hide the sidebar. Still works while settings is open.',
  'terminal.toggle': 'Open or close the terminal drawer.',
  'terminal.focus': 'Open the terminal drawer and focus it.',
  'terminal.clear': 'Clear the terminal when it is available.',
  'gitops.open': 'Open GitOps from code threads.',
  'gitops.toggleChangedFiles': 'Show or hide the changed files list in GitOps.',
  'thread.previousInProject': 'Move to the previous thread in the current context.',
  'thread.nextInProject': 'Move to the next thread in the current context.',
  'composer.submit': 'Submit the current prompt.',
  'composer.newline': 'Insert a newline in the prompt.',
  'composer.focus': 'Focus the prompt input.',
  'agent.interrupt': 'Stop the active run with a double Escape.',
  'dictation.toggle': 'Start or stop dictation from the composer.',
}

const keybindingOrder: KeybindingCommandId[] = [
  'settings.open',
  'app.commandPalette',
  'sidebar.toggle',
  'thread.new',
  'thread.previousInProject',
  'thread.nextInProject',
  'thread.find',
  'sidebar.find',
  'terminal.toggle',
  'terminal.focus',
  'terminal.clear',
  'gitops.open',
  'gitops.toggleChangedFiles',
  'composer.submit',
  'composer.newline',
  'composer.focus',
  'dictation.toggle',
  'agent.interrupt',
]

function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'linux'
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'windows'
  return 'linux'
}

function getKeybindingOverride(appSettings: AppSettings, commandId: KeybindingCommandId) {
  const override = appSettings.keybindings[commandId]
  return typeof override === 'string' ? override : ''
}

function formatAccelerator(value: string, platform: Platform) {
  const mac = platform === 'mac'
  const labels: Record<string, string> = mac
    ? {
        CmdOrCtrl: '⌘',
        Cmd: '⌘',
        Ctrl: '⌃',
        Alt: '⌥',
        Shift: '⇧',
        Escape: 'Esc',
        Space: 'Space',
      }
    : {
        CmdOrCtrl: 'Ctrl',
        Cmd: 'Cmd',
        Ctrl: 'Ctrl',
        Alt: 'Alt',
        Shift: 'Shift',
        Escape: 'Esc',
        Space: 'Space',
      }
  return value
    .split(' ')
    .map((chord) =>
      chord
        .split('+')
        .map((part) => labels[part] ?? part)
        .join(mac ? '' : '+'),
    )
    .join(' then ')
}

function keyEventToAccelerator(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key === 'Tab') return null
  if (event.key === 'Escape') return null
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  if (!(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)) return null
  return eventToAcceleratorCandidates(event)[0] ?? null
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
    if (normalized && isValidAccelerator(normalized)) nextKeybindings[input.commandId] = normalized
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

function ShortcutRecorder({
  appSettings,
  commandId,
  onAction,
  platform,
}: {
  appSettings: AppSettings
  commandId: KeybindingCommandId
  onAction: DesktopActionInvoker
  platform: Platform
}) {
  const persistedOverride = getKeybindingOverride(appSettings, commandId)
  const [draft, setDraft] = useState(persistedOverride)
  const [recording, setRecording] = useState(false)
  const conflict = getConflictForCommand(commandId, appSettings.keybindings)
  const disabled = appSettings.keybindings[commandId] === null
  const binding = bundledKeybindings.find((item) => item.id === commandId)
  const hasCustomShortcut = draft.length > 0

  useEffect(() => {
    setDraft(persistedOverride)
  }, [persistedOverride])

  const displayed = disabled
    ? 'Disabled'
    : draft
      ? formatAccelerator(draft, platform)
      : binding?.defaults.map((value) => formatAccelerator(value, platform)).join(' / ') || 'Unset'

  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5">
      {conflict ? (
        <span className={`max-w-32 truncate pr-1 ${appTypeMetaClass} text-[color:var(--warning)]`}>
          Conflict
        </span>
      ) : null}
      <button
        type="button"
        className={cn(
          'min-h-9 min-w-40 rounded-xl px-3 text-left transition-[background-color,box-shadow,scale] active:scale-[0.96]',
          recording
            ? 'bg-[color:var(--accent-bg-subtle)] shadow-[inset_0_0_0_1px_var(--accent-border),0_0_0_3px_rgba(124,147,255,0.12)]'
            : 'bg-[rgba(255,255,255,0.055)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.075)]',
          !(hasCustomShortcut || disabled || recording) && 'opacity-55',
          disabled && 'opacity-45',
          conflict && 'shadow-[inset_0_0_0_1px_var(--warning)]',
        )}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onClick={() => setRecording(true)}
        onKeyDown={(event) => {
          if (event.key === 'Tab') return
          if (event.key === 'Escape') {
            event.currentTarget.blur()
            return
          }
          event.preventDefault()
          if (event.key === 'Backspace' || event.key === 'Delete') {
            setDraft('')
            resetKeybinding({ appSettings, commandId, onAction })
            return
          }
          const accelerator = keyEventToAccelerator(event)
          if (!accelerator) return
          setDraft(accelerator)
          updateKeybinding({ appSettings, commandId, value: accelerator, onAction })
          event.currentTarget.blur()
        }}
        aria-label={`Record shortcut for ${binding?.label ?? commandId}`}
      >
        <span className={`block truncate ${appTypeSmallClass} ${appToneTextClass}`}>
          {recording ? 'Press keys…' : displayed}
        </span>
      </button>
      <button
        type="button"
        className={compactIconButtonClass}
        onClick={() => {
          setDraft('')
          if (disabled) resetKeybinding({ appSettings, commandId, onAction })
          else updateKeybinding({ appSettings, commandId, value: null, onAction })
        }}
        aria-label={disabled ? 'Enable shortcut' : 'Disable shortcut'}
      >
        {disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />}
      </button>
      <button
        type="button"
        className={compactIconButtonClass}
        onClick={() => {
          setDraft('')
          resetKeybinding({ appSettings, commandId, onAction })
        }}
        aria-label="Reset shortcut"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}

function buildShortcutSetting(input: {
  commandId: KeybindingCommandId
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  platform: Platform
}): SettingDescriptor {
  const binding = bundledKeybindings.find((item) => item.id === input.commandId)
  return {
    id: `keybindings.${input.commandId}`,
    category: 'keybindings',
    title: binding?.label ?? input.commandId,
    description: commandHelp[input.commandId],
    helpDescription: commandHelp[input.commandId],
    keywords: `keyboard shortcut keybinding hotkey ${input.commandId}`,
    render: () => (
      <ShortcutRecorder
        appSettings={input.appSettings}
        commandId={input.commandId}
        onAction={input.onAction}
        platform={input.platform}
      />
    ),
  }
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
  const platform = getPlatform()
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
          className="w-[13.75rem]"
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
    ...keybindingOrder.map((commandId) =>
      buildShortcutSetting({ commandId, appSettings, onAction, platform }),
    ),
  ]
}
