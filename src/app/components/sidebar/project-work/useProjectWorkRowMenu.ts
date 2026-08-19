import { useLayoutEffect, useRef, useState } from 'react'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'

type ProjectWorkRowKind = 'project' | 'branch'

const rowSelectors: Record<ProjectWorkRowKind, string> = {
  project:
    '.sidebar-project-work-project-block-heading-row, .sidebar-project-work-toolbar, .sidebar-project-work-section-heading',
  branch: '.sidebar-project-work-branch-heading',
}

export function useProjectWorkRowMenu(rowKind: ProjectWorkRowKind) {
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(240)
  const [right, setRight] = useState(0)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useDismissibleLayer({
    open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, panelRef],
  })
  useLayoutEffect(() => {
    if (!(open && triggerRef.current)) return
    const anchor = triggerRef.current
    const rowRect = anchor.closest(rowSelectors[rowKind])?.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    if (!rowRect) {
      setWidth(rowKind === 'branch' ? 240 : anchor.offsetLeft + anchor.offsetWidth)
      setRight(0)
      return
    }
    setWidth(rowRect.width)
    setRight(anchorRect.right - rowRect.right)
  }, [open, rowKind])

  return {
    open,
    panelRef,
    right,
    setOpen,
    triggerRef,
    width,
  }
}
