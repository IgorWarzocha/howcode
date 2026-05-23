import { type RefObject, useEffect } from 'react'

type ActiveOptionState = {
  activeDescendantId: string | null | undefined
  open: boolean
  selectedIndex: number
}

export function useInboxSlashCommandActiveOptionScroll({
  listSignature,
  panelRef,
  state,
}: {
  listSignature: string
  panelRef: RefObject<HTMLDivElement | null>
  state: ActiveOptionState
}) {
  useEffect(() => {
    if (!(state.open && state.activeDescendantId)) {
      return
    }

    void listSignature

    const panel = panelRef.current
    const option = panel?.querySelector<HTMLElement>(`#${state.activeDescendantId}`)
    if (!(panel && option)) {
      return
    }

    if (state.selectedIndex === 0) {
      panel.scrollTop = 0
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
  }, [listSignature, panelRef, state.activeDescendantId, state.open, state.selectedIndex])
}

export function useInboxMentionActiveOptionScroll({
  listSignature,
  panelRef,
  state,
}: {
  listSignature: string
  panelRef: RefObject<HTMLDivElement | null>
  state: ActiveOptionState
}) {
  useEffect(() => {
    if (!(state.open && state.activeDescendantId)) return
    void listSignature
    const panel = panelRef.current
    const option = panel?.querySelector<HTMLElement>(`#${state.activeDescendantId}`)
    if (!(panel && option)) return
    if (state.selectedIndex === 0) {
      panel.scrollTop = 0
      return
    }
    option.scrollIntoView({ block: 'nearest' })
  }, [listSignature, panelRef, state.activeDescendantId, state.open, state.selectedIndex])
}
