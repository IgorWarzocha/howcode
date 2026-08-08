import {
  bundledKeybindings,
  eventToAcceleratorCandidates,
  getConflictForCommand,
  isRightAltKeyEvent,
  isRightAltShortcutEvent,
} from '@howcode/shared/keybindings'
import { Ban, CheckCircle2, RotateCcw } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { AppSettings, DesktopActionInvoker, KeybindingCommandId } from '../../desktop/types'
import {
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
  compactIconButtonClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import {
  applyKeybindingMutation,
  formatSettingsAccelerator,
  getKeybindingOverride,
  type KeybindingMutation,
  type SettingsPlatform,
} from './settingsKeybindings'

function keyEventToAccelerator(event: KeyboardEvent<HTMLButtonElement>, rightAltPressed: boolean) {
  if (event.key === 'Tab' || event.key === 'Escape') return null
  if (isRightAltKeyEvent(event) || isRightAltShortcutEvent(event, rightAltPressed)) return null
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  if (!(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)) return null
  return eventToAcceleratorCandidates(event)[0] ?? null
}

export function SettingsShortcutRecorder({
  appSettings,
  commandId,
  onAction,
  platform,
}: {
  appSettings: AppSettings
  commandId: KeybindingCommandId
  onAction: DesktopActionInvoker
  platform: SettingsPlatform
}) {
  const persistedOverride = getKeybindingOverride(appSettings, commandId)
  const [draft, setDraft] = useState(persistedOverride)
  const [recording, setRecording] = useState(false)
  const rightAltPressedRef = useRef(false)
  const conflict = getConflictForCommand(commandId, appSettings.keybindings)
  const disabled = appSettings.keybindings[commandId] === null
  const binding = bundledKeybindings.find((item) => item.id === commandId)
  const displayed = disabled
    ? 'Disabled'
    : draft
      ? formatSettingsAccelerator(draft, platform)
      : binding?.defaults.map((value) => formatSettingsAccelerator(value, platform)).join(' / ') ||
        'Unset'

  useEffect(() => setDraft(persistedOverride), [persistedOverride])

  const persistMutation = (mutation: KeybindingMutation) =>
    void onAction('settings.update', {
      key: 'keybindings',
      value: applyKeybindingMutation(appSettings.keybindings, commandId, mutation),
    })

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
          'min-h-9 min-w-40 rounded-xl px-3 text-left transition-[background-color,scale] active:scale-[0.96]',
          recording
            ? 'bg-[color:var(--accent-bg-subtle)]'
            : 'bg-[rgba(255,255,255,0.055)] hover:bg-[rgba(255,255,255,0.075)]',
          !(draft || disabled || recording) && 'opacity-55',
          disabled && 'opacity-45',
        )}
        onFocus={() => setRecording(true)}
        onBlur={() => {
          rightAltPressedRef.current = false
          setRecording(false)
        }}
        onClick={() => setRecording(true)}
        onKeyDown={(event) => {
          if (event.key === 'Tab') return
          if (event.key === 'Escape') {
            event.currentTarget.blur()
            return
          }
          event.preventDefault()
          if (isRightAltKeyEvent(event)) {
            rightAltPressedRef.current = true
            return
          }
          if (!event.altKey) rightAltPressedRef.current = false
          if (event.key === 'Backspace' || event.key === 'Delete') {
            setDraft('')
            persistMutation({ kind: 'reset' })
            return
          }
          const accelerator = keyEventToAccelerator(event, rightAltPressedRef.current)
          if (!accelerator) return
          setDraft(accelerator)
          persistMutation({ kind: 'set', accelerator })
          event.currentTarget.blur()
        }}
        onKeyUp={(event) => {
          if (isRightAltKeyEvent(event)) rightAltPressedRef.current = false
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
          persistMutation({ kind: disabled ? 'reset' : 'disable' })
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
          persistMutation({ kind: 'reset' })
        }}
        aria-label="Reset shortcut"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}
