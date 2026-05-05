import { AudioLines, Check, FileAudio, Mic, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DesktopActionInvoker } from '../../../desktop/types'
import { useAnimatedPresence } from '../../../hooks/useAnimatedPresence'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import { compactCardClass, compactIconButtonClass, iconButtonClass } from '../../../ui/classes'
import { cn } from '../../../utils/cn'
import { TextButton } from '../../common/text-button'

type ComposerDictationControlsProps = {
  dictationActive: boolean
  dictationMissingModel: boolean
  dictationSupported: boolean
  dictationTranscribing: boolean
  placement?: 'inline' | 'trailing'
  onAction: DesktopActionInvoker
  onOpenSettingsView: () => void
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
  onAction,
  onDismiss,
  onOpenSettingsView,
  open,
  promptRef,
}: {
  onAction: DesktopActionInvoker
  onDismiss: () => void
  onOpenSettingsView: () => void
  open: boolean
  promptRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={promptRef}
      data-open={open ? 'true' : 'false'}
      className={cn(
        compactCardClass,
        'absolute right-[calc(100%+8px)] top-1/2 z-20 inline-flex items-center gap-1.5 whitespace-nowrap -translate-y-1/2 rounded-full px-2 py-1 text-[10.5px] shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-180 ease-out',
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-2 opacity-0',
      )}
    >
      <span className="pr-1 text-[10.5px] text-[color:var(--text)] whitespace-nowrap">
        No speech-to-text model detected. Install?
      </span>
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          'h-6 w-6 rounded-full bg-[color:var(--accent)] text-[color:var(--accent-contrast)] hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)]',
        )}
        onClick={() => {
          onDismiss()
          onOpenSettingsView()
        }}
        aria-label="Open app settings to install speech-to-text"
        data-tooltip="Open app settings"
      >
        <Check size={12} />
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
      <TextButton
        className="rounded-full border border-[color:var(--danger-border)] px-2 py-0.5 text-[10px] leading-4 whitespace-nowrap text-[color:var(--danger)] hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)] hover:text-[color:var(--danger)]"
        onClick={() => {
          onDismiss()
          void onAction('settings.update', { key: 'showDictationButton', value: false })
        }}
      >
        Hide permanently
      </TextButton>
    </div>
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
            ? 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--muted-2)] opacity-45 transition-colors hover:bg-[rgba(255,255,255,0.035)] hover:text-[color:var(--muted)] hover:opacity-70'
            : iconButtonClass,
          dictationActive &&
            'border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger)] opacity-100',
          dictationTranscribing &&
            'border-[color:var(--accent-border)] bg-[color:var(--accent-bg)] text-[color:var(--text)] opacity-100',
          dictationPromptOpen &&
            'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)] text-[color:var(--text)] opacity-100',
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
