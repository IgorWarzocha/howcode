import { useDictationCommand } from '@howcode/plugins/dictation/ui'
import { type RefObject, useEffect, useEffectEvent } from 'react'
import {
  howcodeDismissTransientUiEvent,
  useHowcodeKeybindingCommand,
} from '../app-shell/keybinding-events'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

export function useComposerGlobalCommands(input: {
  closeConversationFork: () => void
  composerPanelRef: RefObject<HTMLDivElement | null>
  composerWorking: boolean
  fileMentions: ComposerFileMentions
  inputLocked: boolean
  openConversationFork: () => void
  send: () => Promise<void>
  setOpenMenu: (menu: null) => void
  showDictationButton: boolean
  skillMentions: ComposerSkillMentions
  slashCommands: ComposerSlashCommands
  toggleDictation: () => Promise<unknown>
}) {
  const dismissTransientUi = () => {
    input.setOpenMenu(null)
    input.slashCommands.dismiss()
    input.closeConversationFork()
    input.fileMentions.dismiss()
    input.skillMentions.dismiss()
  }
  const dismissTransientUiEvent = useEffectEvent(dismissTransientUi)

  useHowcodeKeybindingCommand('composer.submit', (event) => {
    event.preventDefault()
    void input.send()
  })
  useHowcodeKeybindingCommand('composer.focus', (event) => {
    event.preventDefault()
    dismissTransientUi()
    const textarea = input.composerPanelRef.current?.querySelector('textarea')
    if (!(textarea instanceof HTMLTextAreaElement)) return
    textarea.focus()
    const cursorPosition = textarea.value.length
    textarea.setSelectionRange(cursorPosition, cursorPosition)
  })
  useHowcodeKeybindingCommand('agent.interrupt', (event) => {
    if (input.composerWorking) return
    event.preventDefault()
    dismissTransientUi()
    input.openConversationFork()
  })
  useDictationCommand(input)

  useEffect(() => {
    window.addEventListener(howcodeDismissTransientUiEvent, dismissTransientUiEvent)
    return () => window.removeEventListener(howcodeDismissTransientUiEvent, dismissTransientUiEvent)
  }, [])
}
