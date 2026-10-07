import { type RefObject, useEffect, useEffectEvent } from 'react'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

function scrollActiveOptionIntoView(input: {
  activeDescendantId: string | null | undefined
  forceTopForFirstOption: boolean
  listSignature: string
  panelRef: RefObject<HTMLDivElement | null>
  selectedIndex: number
}) {
  void input.listSignature
  if (!input.activeDescendantId) return
  const panel = input.panelRef.current
  const option = panel?.querySelector<HTMLElement>(`#${input.activeDescendantId}`)
  if (!(panel && option)) return
  if (input.selectedIndex === 0) {
    panel.scrollTop = 0
    return
  }
  if (!input.forceTopForFirstOption) {
    option.scrollIntoView({ block: 'nearest' })
    return
  }
  const panelStyles = window.getComputedStyle(panel)
  const paddingTop = Number.parseFloat(panelStyles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(panelStyles.paddingBottom) || 0
  const visibleTop = panel.scrollTop + paddingTop
  const visibleBottom = panel.scrollTop + panel.clientHeight - paddingBottom
  const optionTop = option.offsetTop
  const optionBottom = optionTop + option.offsetHeight
  if (optionTop < visibleTop) {
    panel.scrollTop = optionTop - paddingTop
  } else if (optionBottom > visibleBottom) {
    panel.scrollTop = optionBottom - panel.clientHeight + paddingBottom
  }
}

type ComposerActiveOptionState = {
  activeDescendantId: string | null | undefined
  open: boolean
  selectedIndex: number
}

export function useComposerActiveOptionScroll(input: {
  forceTopForFirstOption: boolean
  listSignature: string
  panelRef: RefObject<HTMLDivElement | null>
  state: ComposerActiveOptionState
}) {
  useEffect(() => {
    if (!input.state.open) return
    scrollActiveOptionIntoView({
      activeDescendantId: input.state.activeDescendantId,
      forceTopForFirstOption: input.forceTopForFirstOption,
      listSignature: input.listSignature,
      panelRef: input.panelRef,
      selectedIndex: input.state.selectedIndex,
    })
  }, [
    input.forceTopForFirstOption,
    input.listSignature,
    input.panelRef,
    input.state.activeDescendantId,
    input.state.open,
    input.state.selectedIndex,
  ])
}

export function useComposerAutocompleteEffects({
  composerPanelRef,
  fileMentionPanelRef,
  fileMentionListSignature,
  fileMentions,
  skillMentionPanelRef,
  skillMentionListSignature,
  skillMentions,
  slashCommandPanelRef,
  slashCommandListSignature,
  slashCommands,
  conversationForkPanelRef,
  stopButtonBoundaryRef,
}: {
  composerPanelRef: RefObject<HTMLDivElement | null>
  fileMentionPanelRef: RefObject<HTMLDivElement | null>
  fileMentionListSignature: string
  fileMentions: ComposerFileMentions
  skillMentionPanelRef: RefObject<HTMLDivElement | null>
  skillMentionListSignature: string
  skillMentions: ComposerSkillMentions
  slashCommandPanelRef: RefObject<HTMLDivElement | null>
  slashCommandListSignature: string
  slashCommands: ComposerSlashCommands
  conversationForkPanelRef?: RefObject<HTMLDivElement | null> | undefined
  stopButtonBoundaryRef: RefObject<HTMLDivElement | null>
}) {
  const handlePointerDown = useEffectEvent((event: PointerEvent) => {
    const target = event.target as Node | null
    if (
      !target ||
      slashCommandPanelRef.current?.contains(target) ||
      conversationForkPanelRef?.current?.contains(target) ||
      fileMentionPanelRef.current?.contains(target) ||
      skillMentionPanelRef.current?.contains(target) ||
      composerPanelRef.current?.contains(target) ||
      stopButtonBoundaryRef.current?.contains(target)
    ) {
      return
    }

    if (slashCommands.open) slashCommands.dismiss({ clearDraft: true })
    if (fileMentions.open) fileMentions.dismiss()
    if (skillMentions.open) skillMentions.dismiss()
  })

  useEffect(() => {
    if (!(slashCommands.open || fileMentions.open || skillMentions.open)) return

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [fileMentions.open, skillMentions.open, slashCommands.open])

  useComposerActiveOptionScroll({
    forceTopForFirstOption: true,
    listSignature: slashCommandListSignature,
    panelRef: slashCommandPanelRef,
    state: slashCommands,
  })
  useComposerActiveOptionScroll({
    forceTopForFirstOption: false,
    listSignature: fileMentionListSignature,
    panelRef: fileMentionPanelRef,
    state: fileMentions,
  })
  useComposerActiveOptionScroll({
    forceTopForFirstOption: false,
    listSignature: skillMentionListSignature,
    panelRef: skillMentionPanelRef,
    state: skillMentions,
  })
}

export function useComposerEscapeEffects({
  cancelDictation,
  dictationActive,
  dictationTranscribing,
  pickerOpen,
  conversationForkOpen,
  onCloseConversationFork,
  setOpenMenu,
}: {
  cancelDictation: () => Promise<void>
  dictationActive: boolean
  dictationTranscribing: boolean
  pickerOpen: boolean
  conversationForkOpen?: boolean | undefined
  onCloseConversationFork?: (() => void) | undefined
  setOpenMenu: (menu: null) => void
}) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (conversationForkOpen === true) {
      event.preventDefault()
      event.stopImmediatePropagation()
      onCloseConversationFork?.()
      return
    }
    if (pickerOpen) {
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpenMenu(null)
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    void cancelDictation()
  })

  useEffect(() => {
    const conversationForkActive = conversationForkOpen === true
    if (!(pickerOpen || dictationActive || dictationTranscribing || conversationForkActive)) return

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [dictationActive, dictationTranscribing, pickerOpen, conversationForkOpen])
}
