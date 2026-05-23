import type { RefObject } from 'react'
import { useEffect } from 'react'

type DismissibleMention = {
  open: boolean
  dismiss: (options?: { clearDraft?: boolean }) => void
}

function isTargetWithinRefs(target: Node, refs: RefObject<Node | null>[]) {
  return refs.some((ref) => ref.current?.contains(target))
}

export function useInboxComposerMentionDismiss({
  composerSurfaceRef,
  fileMentionPanelRef,
  fileMentions,
  setOpenMenu,
  skillMentionPanelRef,
  skillMentions,
  slashCommandPanelRef,
  slashCommands,
}: {
  composerSurfaceRef: RefObject<Node | null>
  fileMentionPanelRef: RefObject<Node | null>
  fileMentions: DismissibleMention
  setOpenMenu: (updater: (current: 'model' | 'picker' | null) => 'model' | 'picker' | null) => void
  skillMentionPanelRef: RefObject<Node | null>
  skillMentions: DismissibleMention
  slashCommandPanelRef: RefObject<Node | null>
  slashCommands: DismissibleMention
}) {
  useEffect(() => {
    if (slashCommands.open || fileMentions.open || skillMentions.open) {
      setOpenMenu((current) => (current === 'picker' ? null : current))
    }
  }, [fileMentions.open, setOpenMenu, skillMentions.open, slashCommands.open])

  useEffect(() => {
    if (!(slashCommands.open || fileMentions.open || skillMentions.open)) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (
        isTargetWithinRefs(target, [
          slashCommandPanelRef,
          fileMentionPanelRef,
          skillMentionPanelRef,
          composerSurfaceRef,
        ])
      ) {
        return
      }

      if (slashCommands.open) slashCommands.dismiss({ clearDraft: true })
      if (fileMentions.open) fileMentions.dismiss()
      if (skillMentions.open) skillMentions.dismiss()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopImmediatePropagation()
      if (slashCommands.open) slashCommands.dismiss()
      if (fileMentions.open) fileMentions.dismiss()
      if (skillMentions.open) skillMentions.dismiss()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [
    composerSurfaceRef,
    fileMentionPanelRef,
    fileMentions,
    skillMentionPanelRef,
    skillMentions,
    slashCommandPanelRef,
    slashCommands,
  ])
}
