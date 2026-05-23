import { Check, GitCommitHorizontal, X } from 'lucide-react'
import { useEffect, useEffectEvent, useId, useRef } from 'react'
import { TextButton } from '../../common/text-button'
import type { AppSettings, ComposerModel, DesktopActionInvoker } from '../../desktop/types'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeGroupTextClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  appTypeViewTitleClass,
  modalPanelClass,
  panelChromeClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

type SettingsPanelProps = {
  appSettings: AppSettings
  availableModels: ComposerModel[]
  currentModel: ComposerModel | null
  open: boolean
  onClose: () => void
  onAction: DesktopActionInvoker
}

export function SettingsPanel({
  appSettings,
  availableModels,
  currentModel,
  open,
  onClose,
  onAction,
}: SettingsPanelProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)
  const selectedModel = appSettings.gitCommitMessageModel
  const closeOnEscape = useEffectEvent(() => onClose())

  useEffect(() => {
    if (!open) {
      return
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeOnEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      lastFocusedElementRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-[rgba(8,10,18,0.52)] backdrop-blur-sm"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          panelChromeClass,
          modalPanelClass,
          'relative z-10 flex w-full max-w-[720px] flex-col overflow-hidden rounded-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <div id={titleId} className={cn(appTypeViewTitleClass, appToneTextClass)}>
              App settings
            </div>
            <p className={cn('mt-1', appTypeGroupTextClass, appToneMutedClass)}>
              Choose which Pi model should be used for git commit message generation when that flow
              is enabled. Until you pick one, the app falls back to the current composer model.
            </p>
          </div>
          <TextButton
            ref={closeButtonRef}
            className="p-1"
            onClick={onClose}
            aria-label="Close app settings dialog"
          >
            <X size={16} />
          </TextButton>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <section className="grid gap-3">
            <div
              className={cn('flex items-center gap-2', appTypeSectionTitleClass, appToneTextClass)}
            >
              <GitCommitHorizontal size={16} />
              <span>Git commit message model</span>
            </div>

            <button
              type="button"
              className={cn(
                'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                selectedModel
                  ? 'border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'
                  : 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)]',
              )}
              onClick={() =>
                onAction('settings.update', { key: 'gitCommitMessageModel', reset: true })
              }
            >
              <div className="min-w-0">
                <div className={cn('truncate', appTypeBodyClass, appToneTextClass)}>
                  Use current composer model
                </div>
                <div className={cn('truncate', appTypeSmallClass, appToneMutedClass)}>
                  {currentModel
                    ? `${currentModel.name} · ${currentModel.provider}/${currentModel.id}`
                    : 'No active composer model'}
                </div>
              </div>
              {selectedModel ? null : <Check size={16} className="text-[color:var(--accent)]" />}
            </button>

            <div className="grid gap-2">
              {availableModels.map((model) => {
                const isSelected =
                  selectedModel?.provider === model.provider && selectedModel.id === model.id

                return (
                  <button
                    key={`${model.provider}/${model.id}`}
                    type="button"
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-[color:var(--accent-border)] bg-[color:var(--accent-bg-subtle)]'
                        : 'border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]',
                    )}
                    onClick={() =>
                      onAction('settings.update', {
                        key: 'gitCommitMessageModel',
                        provider: model.provider,
                        modelId: model.id,
                      })
                    }
                  >
                    <div className="min-w-0">
                      <div className={cn('truncate', appTypeBodyClass, appToneTextClass)}>
                        {model.name}
                      </div>
                      <div className={cn('truncate', appTypeSmallClass, appToneMutedClass)}>
                        {model.provider}/{model.id}
                      </div>
                    </div>
                    {isSelected ? <Check size={16} className="text-[color:var(--accent)]" /> : null}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </dialog>
    </div>
  )
}
