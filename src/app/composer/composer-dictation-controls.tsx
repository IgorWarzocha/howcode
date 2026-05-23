import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { AudioLines, Check, FileAudio, Mic, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PopoverPanel } from '../common/popover'
import { TextButton } from '../common/text-button'
import type { DesktopActionInvoker } from '../desktop/types'
import { useAnimatedPresence } from '../hooks/useAnimatedPresence'
import { useDismissibleLayer } from '../hooks/useDismissibleLayer'
import {
  appToneDangerClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeTinyClass,
  appTypeTinyStrongClass,
  compactIconButtonClass,
  iconButtonClass,
} from '../ui/classes'
import { cn } from '../utils/cn'

type ComposerDictationControlsProps = {
  dictationActive: boolean
  dictationMissingModel: boolean
  dictationSupported: boolean
  dictationTranscribing: boolean
  placement?: 'inline' | 'trailing'
  onAction: DesktopActionInvoker
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  showDictationButton: boolean
  toggleDictation: () => Promise<'started' | 'stopped' | 'setup-required' | 'unavailable'>
}

function getDictationButtonAriaLabel(input: {
  dictationActive: boolean
  dictationTranscribing: boolean
}) {
  if (input.dictationActive) return 'Stop dictation'
  if (input.dictationTranscribing) return 'Transcribing dictation'
  return 'Dictate'
}

function getDictationButtonTooltip(input: {
  dictationActive: boolean
  dictationMissingModel: boolean
  dictationSupported: boolean
  dictationTranscribing: boolean
}) {
  if (input.dictationActive) return 'Stop dictation'
  if (input.dictationTranscribing) return 'Transcribing dictation'
  if (input.dictationSupported) return 'Dictate'
  if (input.dictationMissingModel) return 'Install model'
  return 'Dictation unavailable'
}

function DictationPrompt({
  anchorRef,
  onAction,
  onDismiss,
  onOpenSettingsView,
  open,
  promptRef,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onAction: DesktopActionInvoker
  onDismiss: () => void
  onOpenSettingsView: (target?: SettingsOpenTarget) => void
  open: boolean
  promptRef: React.RefObject<HTMLDivElement | null>
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect()
      if (!anchorRect) return

      const promptRect = promptRef.current?.getBoundingClientRect()
      const viewportPadding = 12
      const promptWidth = promptRect?.width ?? 312
      const promptHeight = promptRect?.height ?? 42
      const preferredLeft = anchorRect.right - promptWidth
      const left = Math.min(
        window.innerWidth - viewportPadding - promptWidth,
        Math.max(viewportPadding, preferredLeft),
      )
      const topAbove = anchorRect.top - promptHeight - 10
      const top =
        topAbove >= viewportPadding
          ? topAbove
          : Math.min(window.innerHeight - viewportPadding - promptHeight, anchorRect.bottom + 10)

      setPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, open, promptRef])

  if (typeof document === 'undefined') return null

  return createPortal(
    <PopoverPanel
      surface={false}
      ref={promptRef}
      open={open}
      role="dialog"
      aria-label="Install speech-to-text model"
      style={position ? { left: `${position.left}px`, top: `${position.top}px` } : undefined}
      className={cn(
        'fixed z-[140] inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--panel)] px-2 py-1 shadow-[0_18px_40px_rgba(0,0,0,0.34)] transition-[opacity,transform] duration-180 ease-out',
        appTypeMetaClass,
        open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
        !position && 'opacity-0',
      )}
    >
      <span className={cn('whitespace-nowrap', appTypeMetaClass, appToneTextClass)}>
        No speech-to-text model detected. Install?
      </span>
      <div className="inline-flex shrink-0 items-center justify-end gap-1">
        <button
          type="button"
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-full bg-[color:var(--accent)] px-2 text-[color:var(--accent-contrast)] transition-transform active:scale-[0.96]',
            appTypeTinyStrongClass,
          )}
          onClick={() => {
            onDismiss()
            onOpenSettingsView({ category: 'dictation', settingId: 'dictation.models' })
          }}
          aria-label="Open dictation settings to install speech-to-text"
        >
          <Check size={12} />
          Yes
        </button>
        <button
          type="button"
          className={cn(compactIconButtonClass, 'h-6 w-6 rounded-full')}
          onClick={onDismiss}
          aria-label="Dismiss dictation setup prompt"
          data-tooltip="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
      <TextButton
        className={cn(
          'shrink-0 rounded-full border border-[color:var(--danger-border)] px-2 py-0.5 whitespace-nowrap hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]',
          appTypeTinyClass,
          appToneDangerClass,
        )}
        onClick={() => {
          onDismiss()
          void onAction('settings.update', { key: 'showDictationButton', value: false })
        }}
      >
        Hide permanently
      </TextButton>
    </PopoverPanel>,
    document.body,
  )
}

function DictationIcon({
  dictationActive,
  dictationTranscribing,
}: {
  dictationActive: boolean
  dictationTranscribing: boolean
}) {
  if (dictationActive) return <AudioLines size={15} />
  if (dictationTranscribing) return <FileAudio size={15} />
  return <Mic size={15} />
}

export function ComposerDictationControls({
  dictationActive,
  dictationMissingModel,
  dictationSupported,
  dictationTranscribing,
  placement = 'inline',
  onAction,
  onOpenSettingsView,
  showDictationButton,
  toggleDictation,
}: ComposerDictationControlsProps) {
  const [dictationPromptOpen, setDictationPromptOpen] = useState(false)
  const dictationButtonRef = useRef<HTMLButtonElement>(null)
  const dictationPromptRef = useRef<HTMLDivElement>(null)
  const dictationPromptPresent = useAnimatedPresence(dictationPromptOpen)

  useDismissibleLayer({
    open: dictationPromptOpen,
    onDismiss: () => setDictationPromptOpen(false),
    refs: [dictationButtonRef, dictationPromptRef],
  })

  useEffect(() => {
    if (!(showDictationButton && dictationMissingModel)) {
      setDictationPromptOpen(false)
    }
  }, [dictationMissingModel, showDictationButton])

  return showDictationButton ? (
    <div className={cn('relative', placement === 'trailing' && 'h-6 w-6 shrink-0')}>
      {dictationPromptPresent ? (
        <DictationPrompt
          anchorRef={dictationButtonRef}
          onAction={onAction}
          onDismiss={() => setDictationPromptOpen(false)}
          onOpenSettingsView={onOpenSettingsView}
          open={dictationPromptOpen}
          promptRef={dictationPromptRef}
        />
      ) : null}
      <button
        ref={dictationButtonRef}
        type="button"
        onClick={async () => {
          dictationButtonRef.current?.blur()
          const result = await toggleDictation()
          setDictationPromptOpen(result === 'setup-required')
        }}
        className={cn(
          placement === 'trailing'
            ? 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--muted-2)] transition-colors hover:bg-[rgba(255,255,255,0.035)] hover:text-[color:var(--muted)]'
            : iconButtonClass,
          dictationActive &&
            'border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
          dictationTranscribing &&
            'border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text)]',
          dictationPromptOpen &&
            'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] text-[color:var(--text)]',
        )}
        aria-label={getDictationButtonAriaLabel({ dictationActive, dictationTranscribing })}
        aria-pressed={dictationActive || dictationTranscribing || dictationPromptOpen}
        data-tooltip={getDictationButtonTooltip({
          dictationActive,
          dictationMissingModel,
          dictationSupported,
          dictationTranscribing,
        })}
      >
        <DictationIcon
          dictationActive={dictationActive}
          dictationTranscribing={dictationTranscribing}
        />
      </button>
    </div>
  ) : null
}
