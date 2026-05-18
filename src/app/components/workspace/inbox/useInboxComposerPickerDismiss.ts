import { type RefObject, useEffect } from 'react'

type InboxComposerOpenMenu = 'model' | 'picker' | null

export function useInboxComposerPickerDismiss({
  composerSurfaceRef,
  openMenu,
  pickerButtonRef,
  pickerPanelRef,
  setOpenMenu,
}: {
  composerSurfaceRef: RefObject<HTMLDivElement | null>
  openMenu: InboxComposerOpenMenu
  pickerButtonRef: RefObject<HTMLButtonElement | null>
  pickerPanelRef: RefObject<HTMLDivElement | null>
  setOpenMenu: (update: (current: InboxComposerOpenMenu) => InboxComposerOpenMenu) => void
}) {
  useEffect(() => {
    if (openMenu !== 'picker') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (!target) {
        return
      }

      if (pickerButtonRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return
      }

      if (composerSurfaceRef.current?.contains(target)) {
        return
      }

      setOpenMenu((current) => (current === 'picker' ? null : current))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      setOpenMenu((current) => (current === 'picker' ? null : current))
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [composerSurfaceRef, openMenu, pickerButtonRef, pickerPanelRef, setOpenMenu])
}
