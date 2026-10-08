import { useEffect } from 'react'
import type { DraftInputContributionProps } from '../../../src/app/composer/draft-input-context'
import { useDictationCommand } from './command'
import { ComposerDictationControls } from './composer-dictation-controls'
import { useComposerDictation } from './useComposerDictation'

export function DictationDraftInput(props: DraftInputContributionProps) {
  const { appSettings } = props
  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    toggleDictation,
  } = useComposerDictation({
    activeView: props.activeView,
    dictationModelId: appSettings.dictationModelId,
    dictationMaxDurationSeconds: appSettings.dictationMaxDurationSeconds,
    draftChatId: props.draftChatId,
    directoryId: props.directoryId,
    conversationId: props.conversationId,
    setDraftValue: props.setDraftValue,
    setErrorMessage: props.setErrorMessage,
  })
  const dictationTranscribing = dictationInterimText.length > 0
  useDictationCommand({
    showDictationButton: appSettings.showDictationButton,
    inputLocked: props.inputLocked,
    toggleDictation,
  })
  useEffect(() => {
    if (!(dictationActive || dictationTranscribing)) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      void cancelDictation()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [cancelDictation, dictationActive, dictationTranscribing])
  return props.children({
    onKeyDown: (event) => {
      if (event.key === 'Escape' && (dictationActive || dictationTranscribing)) {
        event.preventDefault()
        void cancelDictation()
      }
    },
    leadingAdornment: (
      <ComposerDictationControls
        dictationActive={dictationActive}
        dictationMissingModel={dictationMissingModel}
        dictationSupported={dictationSupported}
        dictationTranscribing={dictationTranscribing}
        onAction={props.onAction}
        onOpenSettingsView={props.onOpenSettingsView}
        showDictationButton={appSettings.showDictationButton && !props.inputLocked}
        toggleDictation={toggleDictation}
      />
    ),
  })
}
