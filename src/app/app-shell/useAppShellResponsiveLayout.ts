import { useLatestRef } from '@howaboua/howcode-sdk/hooks/useLatestRef'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const COMPACT_SIDEBAR_MAX_WIDTH = 1236

function windowUsesCompactSidebar() {
  return typeof window !== 'undefined' && window.innerWidth <= COMPACT_SIDEBAR_MAX_WIDTH
}

export function useAppShellResponsiveLayout(
  terminal: { onEnterCompact: () => void; closeOnComposerFocus: () => void },
  sidebarAvailable: boolean,
) {
  const terminalRef = useLatestRef(terminal)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarCompactMode, setSidebarCompactMode] = useState(windowUsesCompactSidebar)
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false)
  const previousWindowCompactModeRef = useRef(sidebarCompactMode)

  useLayoutEffect(() => {
    const updateSidebarCompactMode = () => {
      const nextCompactMode = windowUsesCompactSidebar()
      const enteredCompactMode = !previousWindowCompactModeRef.current && nextCompactMode
      previousWindowCompactModeRef.current = nextCompactMode
      if (enteredCompactMode) terminalRef.current.onEnterCompact()
      setSidebarCompactMode(nextCompactMode)
    }
    updateSidebarCompactMode()
    window.addEventListener('resize', updateSidebarCompactMode)
    return () => window.removeEventListener('resize', updateSidebarCompactMode)
  }, [terminalRef])

  useEffect(() => {
    if (!sidebarCompactMode) setSidebarOverlayOpen(false)
  }, [sidebarCompactMode])

  useEffect(() => {
    if (!(sidebarAvailable && sidebarOverlayOpen)) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setSidebarOverlayOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarAvailable, sidebarOverlayOpen])

  const handleToggleSidebar = useCallback(() => {
    if (!sidebarAvailable) return
    if (sidebarCompactMode) {
      setSidebarCollapsed(false)
      setSidebarOverlayOpen((open) => !open)
      return
    }
    setSidebarCollapsed((collapsed) => !collapsed)
  }, [sidebarAvailable, sidebarCompactMode])

  const handleOpenSidebar = useCallback(() => {
    if (!sidebarAvailable) return
    setSidebarCollapsed(false)
    if (sidebarCompactMode) setSidebarOverlayOpen(true)
  }, [sidebarAvailable, sidebarCompactMode])

  const handleFocusComposer = useCallback(() => {
    if (!sidebarCompactMode) return
    setSidebarOverlayOpen(false)
    terminalRef.current.closeOnComposerFocus()
  }, [terminalRef, sidebarCompactMode])

  const handleFocusTerminal = useCallback(() => {
    if (sidebarCompactMode) setSidebarOverlayOpen(false)
  }, [sidebarCompactMode])

  return {
    handleFocusComposer,
    handleFocusTerminal,
    handleOpenSidebar,
    handleToggleSidebar,
    setSidebarOverlayOpen,
    sidebarCollapsed,
    sidebarCompactMode,
    sidebarOverlayOpen: sidebarAvailable && sidebarOverlayOpen,
  }
}
