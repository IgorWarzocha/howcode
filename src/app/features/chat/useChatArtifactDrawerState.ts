import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence'
import { subscribeDesktopEvents } from '../../query/desktop-query'

export const ARTIFACT_DRAWER_WIDTH = 'clamp(320px, calc(100% - 820px), 760px)'

type UseChatArtifactDrawerStateInput = {
  conversationId: string | null | undefined
  sidebarCompactMode: boolean
  settingsOpen: boolean
  onArtifactDrawerOverlayChange?:
    | ((visible: boolean, onClose?: (() => void) | undefined) => void)
    | undefined
}

export type ChatArtifactDrawerState = ReturnType<typeof useChatArtifactDrawerState>

export function useChatArtifactDrawerState({
  conversationId,
  sidebarCompactMode,
  settingsOpen,
  onArtifactDrawerOverlayChange,
}: UseChatArtifactDrawerStateInput) {
  const [artifactsVisibleByConversation, setArtifactsVisibleByConversation] = useState<
    Record<string, boolean>
  >({})
  const [artifactsFullscreen, setArtifactsFullscreen] = useState(false)
  const desktopContentRef = useRef<HTMLDivElement>(null)
  const artifactDrawerRef = useRef<HTMLDivElement>(null)
  const artifactOverlayPreviousFocusRef = useRef<HTMLElement | null>(null)
  const previousConversationIdRef = useRef<string | null | undefined>(conversationId)

  const artifactsVisible = conversationId
    ? (artifactsVisibleByConversation[conversationId] ?? false)
    : false
  const artifactDrawerVisible = artifactsVisible && !artifactsFullscreen
  const artifactDrawerOverlay = sidebarCompactMode
  const showDesktopArtifactDrawer = artifactDrawerVisible && !artifactDrawerOverlay
  const artifactDrawerPresent = useAnimatedPresence(artifactDrawerVisible)
  const artifactDrawerInsetStyle = showDesktopArtifactDrawer
    ? { right: ARTIFACT_DRAWER_WIDTH }
    : undefined
  const artifactDrawerStyle = artifactDrawerPresent
    ? { width: artifactDrawerOverlay ? '100%' : ARTIFACT_DRAWER_WIDTH }
    : undefined

  const handleCloseArtifacts = useCallback(() => {
    if (conversationId) {
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: false,
      }))
    }
    setArtifactsFullscreen(false)
  }, [conversationId])

  const toggleArtifacts = useCallback(() => {
    if (!conversationId) return
    setArtifactsVisibleByConversation((current) => ({
      ...current,
      [conversationId]: !(current[conversationId] ?? false),
    }))
  }, [conversationId])

  useEffect(() => {
    const desktopContentElement = desktopContentRef.current
    if (!desktopContentElement) return
    const shouldInertDesktopContent = artifactDrawerOverlay && artifactDrawerVisible
    if (shouldInertDesktopContent) {
      desktopContentElement.setAttribute('inert', '')
      desktopContentElement.setAttribute('aria-hidden', 'true')
      return () => {
        desktopContentElement.removeAttribute('inert')
        desktopContentElement.removeAttribute('aria-hidden')
      }
    }

    desktopContentElement.removeAttribute('inert')
    desktopContentElement.removeAttribute('aria-hidden')
  }, [artifactDrawerOverlay, artifactDrawerVisible])

  useEffect(() => {
    if (!(artifactDrawerOverlay && artifactDrawerVisible)) return
    const drawerElement = artifactDrawerRef.current
    if (!drawerElement) return
    if (document.activeElement && drawerElement.contains(document.activeElement)) return
    artifactOverlayPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const animationFrame = window.requestAnimationFrame(() => {
      const focusTarget = drawerElement.querySelector<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      focusTarget?.focus()
    })
    return () => {
      window.cancelAnimationFrame(animationFrame)
      const previousFocus = artifactOverlayPreviousFocusRef.current
      artifactOverlayPreviousFocusRef.current = null
      if (!previousFocus?.isConnected) return
      if (
        document.activeElement instanceof HTMLElement &&
        drawerElement.contains(document.activeElement)
      ) {
        previousFocus.focus()
      }
    }
  }, [artifactDrawerOverlay, artifactDrawerVisible])

  useEffect(() => {
    if (!conversationId) return
    return subscribeDesktopEvents((event) => {
      if (event.type !== 'artifact-update') return
      if (event.conversationId !== conversationId) return
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: true,
      }))
    })
  }, [conversationId])

  if (previousConversationIdRef.current !== conversationId) {
    previousConversationIdRef.current = conversationId
    if (artifactsFullscreen) setArtifactsFullscreen(false)
  }

  useEffect(() => {
    if (!artifactsVisible) setArtifactsFullscreen(false)
  }, [artifactsVisible])

  useEffect(() => {
    const overlayVisible = artifactDrawerVisible && artifactDrawerOverlay
    onArtifactDrawerOverlayChange?.(
      overlayVisible,
      overlayVisible ? handleCloseArtifacts : undefined,
    )
    return () => onArtifactDrawerOverlayChange?.(false)
  }, [
    artifactDrawerOverlay,
    artifactDrawerVisible,
    handleCloseArtifacts,
    onArtifactDrawerOverlayChange,
  ])

  useEffect(() => {
    if (!(artifactsVisible && (artifactDrawerOverlay || artifactsFullscreen))) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (settingsOpen) return
      event.preventDefault()
      event.stopPropagation()
      if (artifactsFullscreen) {
        setArtifactsFullscreen(false)
        return
      }
      handleCloseArtifacts()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [
    artifactDrawerOverlay,
    artifactsFullscreen,
    artifactsVisible,
    handleCloseArtifacts,
    settingsOpen,
  ])

  return {
    artifactDrawerInsetStyle,
    artifactDrawerPresent,
    artifactDrawerRef,
    artifactDrawerStyle,
    artifactDrawerVisible,
    artifactsFullscreen,
    artifactsVisible,
    desktopContentRef,
    handleCloseArtifacts,
    setArtifactsFullscreen,
    showDesktopArtifactDrawer,
    toggleArtifacts,
  }
}
