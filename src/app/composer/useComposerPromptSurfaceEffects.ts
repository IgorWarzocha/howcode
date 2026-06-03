import { type RefObject, useEffect } from 'react'
import type { ComposerFileMentions } from './useComposerFileMentions'
import type { ComposerSkillMentions } from './useComposerSkillMentions'
import type { ComposerSlashCommands } from './useComposerSlashCommands'

function scrollActiveOptionIntoView(input: {
  activeDescendantId: string | undefined
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
  sessionTreePanelRef,
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
  sessionTreePanelRef?: RefObject<HTMLDivElement | null> | undefined
  stopButtonBoundaryRef: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!(slashCommands.open || fileMentions.open || skillMentions.open)) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        !target ||
        slashCommandPanelRef.current?.contains(target) ||
        sessionTreePanelRef?.current?.contains(target) ||
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
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [
    composerPanelRef,
    fileMentionPanelRef,
    fileMentions,
    skillMentionPanelRef,
    skillMentions,
    sessionTreePanelRef,
    slashCommandPanelRef,
    slashCommands,
    stopButtonBoundaryRef,
  ])

  useEffect(() => {
    if (!slashCommands.open) return
    scrollActiveOptionIntoView({
      activeDescendantId: slashCommands.activeDescendantId,
      forceTopForFirstOption: true,
      listSignature: slashCommandListSignature,
      panelRef: slashCommandPanelRef,
      selectedIndex: slashCommands.selectedIndex,
    })
  }, [
    slashCommandListSignature,
    slashCommandPanelRef,
    slashCommands.activeDescendantId,
    slashCommands.open,
    slashCommands.selectedIndex,
  ])

  useEffect(() => {
    if (!fileMentions.open) return
    scrollActiveOptionIntoView({
      activeDescendantId: fileMentions.activeDescendantId,
      forceTopForFirstOption: false,
      listSignature: fileMentionListSignature,
      panelRef: fileMentionPanelRef,
      selectedIndex: fileMentions.selectedIndex,
    })
  }, [
    fileMentionListSignature,
    fileMentionPanelRef,
    fileMentions.activeDescendantId,
    fileMentions.open,
    fileMentions.selectedIndex,
  ])

  useEffect(() => {
    if (!skillMentions.open) return
    scrollActiveOptionIntoView({
      activeDescendantId: skillMentions.activeDescendantId,
      forceTopForFirstOption: false,
      listSignature: skillMentionListSignature,
      panelRef: skillMentionPanelRef,
      selectedIndex: skillMentions.selectedIndex,
    })
  }, [
    skillMentionListSignature,
    skillMentionPanelRef,
    skillMentions.activeDescendantId,
    skillMentions.open,
    skillMentions.selectedIndex,
  ])
}

export function useComposerEscapeEffects({
  cancelDictation,
  dictationActive,
  dictationTranscribing,
  pickerOpen,
  setOpenMenu,
}: {
  cancelDictation: () => Promise<void>
  dictationActive: boolean
  dictationTranscribing: boolean
  pickerOpen: boolean
  setOpenMenu: (menu: null) => void
}) {
  useEffect(() => {
    if (!(pickerOpen || dictationActive || dictationTranscribing)) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
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
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [cancelDictation, dictationActive, dictationTranscribing, pickerOpen, setOpenMenu])
}
