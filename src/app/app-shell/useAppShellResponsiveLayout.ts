import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLatestRef } from '../hooks/useLatestRef'
import type { AppShellController } from './useAppShellController'

const COMPACT_SIDEBAR_MAX_WIDTH = 1236

function windowUsesCompactSidebar() {
  return typeof window !== 'undefined' && window.innerWidth <= COMPACT_SIDEBAR_MAX_WIDTH
}

export function useAppShellResponsiveLayout(
  controller: AppShellController,
  terminal: { onEnterCompact: () => void; closeOnComposerFocus: () => void },
) {
  const terminalRef = useLatestRef(terminal)
  const controllerRef = useLatestRef(controller)
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
    if (!sidebarOverlayOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || controllerRef.current.workspace.state.settingsOpen) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setSidebarOverlayOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [controllerRef, sidebarOverlayOpen])

  const handleToggleSidebar = useCallback(() => {
    if (sidebarCompactMode) {
      setSidebarCollapsed(false)
      setSidebarOverlayOpen((open) => !open)
      return
    }
    setSidebarCollapsed((collapsed) => !collapsed)
  }, [sidebarCompactMode])

  const handleOpenSidebar = useCallback(() => {
    setSidebarCollapsed(false)
    if (sidebarCompactMode) setSidebarOverlayOpen(true)
  }, [sidebarCompactMode])

  const handleFocusComposer = useCallback(() => {
    if (!sidebarCompactMode) return
    setSidebarOverlayOpen(false)
    terminalRef.current.closeOnComposerFocus()
  }, [terminalRef, sidebarCompactMode])

  const handleFocusTerminal = useCallback(() => {
    if (sidebarCompactMode) setSidebarOverlayOpen(false)
  }, [sidebarCompactMode])

  return {
    controllerRef,
    handleFocusComposer,
    handleFocusTerminal,
    handleOpenSidebar,
    handleToggleSidebar,
    setSidebarOverlayOpen,
    sidebarCollapsed,
    sidebarCompactMode,
    sidebarOverlayOpen,
  }
}
