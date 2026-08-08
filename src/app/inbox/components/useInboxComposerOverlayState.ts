import { useRef, useState } from 'react'
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer'
import type { InboxComposerOpenMenu } from './inbox-composer-types'
import { useInboxComposerPickerDismiss } from './useInboxComposerPickerDismiss'

export function useInboxComposerOverlayState() {
  const [openMenu, setOpenMenu] = useState<InboxComposerOpenMenu>(null)
  const composerSurfaceRef = useRef<HTMLDivElement>(null)
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const pickerPanelRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const sessionTreePanelRef = useRef<HTMLDivElement>(null)
  const slashCommandPanelRef = useRef<HTMLDivElement>(null)
  const fileMentionPanelRef = useRef<HTMLDivElement>(null)
  const skillMentionPanelRef = useRef<HTMLDivElement>(null)

  useDismissibleLayer({
    open: openMenu === 'model',
    onDismiss: () => setOpenMenu(null),
    refs: [modelButtonRef, modelMenuRef],
  })

  useInboxComposerPickerDismiss({
    composerSurfaceRef,
    openMenu,
    pickerButtonRef,
    pickerPanelRef,
    setOpenMenu,
  })

  return {
    composerSurfaceRef,
    fileMentionPanelRef,
    modelButtonRef,
    modelMenuRef,
    openMenu,
    pickerButtonRef,
    pickerPanelRef,
    sessionTreePanelRef,
    setOpenMenu,
    skillMentionPanelRef,
    slashCommandPanelRef,
  }
}

export type InboxComposerOverlayState = ReturnType<typeof useInboxComposerOverlayState>
