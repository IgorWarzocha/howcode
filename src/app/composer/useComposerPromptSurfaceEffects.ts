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
  const handlePointerDown = useEffectEvent((event: PointerEvent) => {
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
  sessionTreeOpen,
  sessionTreeNavigateConfirmOpen,
  sessionTreeLabelPopoverOpen,
  onCloseSessionTree,
  onCancelSessionTreeNavigateConfirm,
  onCancelSessionTreeLabelPopover,
  setOpenMenu,
}: {
  cancelDictation: () => Promise<void>
  dictationActive: boolean
  dictationTranscribing: boolean
  pickerOpen: boolean
  sessionTreeOpen?: boolean | undefined
  sessionTreeNavigateConfirmOpen?: boolean | undefined
  sessionTreeLabelPopoverOpen?: boolean | undefined
  onCloseSessionTree?: (() => void) | undefined
  onCancelSessionTreeNavigateConfirm?: (() => void) | undefined
  onCancelSessionTreeLabelPopover?: (() => void) | undefined
  setOpenMenu: (menu: null) => void
}) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (sessionTreeOpen === true) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (sessionTreeLabelPopoverOpen) {
        onCancelSessionTreeLabelPopover?.()
      } else if (sessionTreeNavigateConfirmOpen) {
        onCancelSessionTreeNavigateConfirm?.()
      } else {
        onCloseSessionTree?.()
      }
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
    const sessionTreeActive = sessionTreeOpen === true
    if (!(pickerOpen || dictationActive || dictationTranscribing || sessionTreeActive)) return

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [dictationActive, dictationTranscribing, pickerOpen, sessionTreeOpen])
}
