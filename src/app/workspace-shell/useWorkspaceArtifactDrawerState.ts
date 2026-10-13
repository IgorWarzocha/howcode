import { useAnimatedPresence } from '@howaboua/howcode-sdk/hooks/useAnimatedPresence'
import { settingsKeybindingLayerIsOpen } from '@howaboua/howcode-sdk/keyboard-layers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useArtifactRenderers } from '../component-system/installed-renderer-context'
import { subscribeDesktopEvents } from '../query/desktop-query'

export const ARTIFACT_DRAWER_WIDTH = 'clamp(320px, calc(100% - 820px), 760px)'

type UseWorkspaceArtifactDrawerStateInput = {
  conversationId: string | null | undefined
  sidebarCompactMode: boolean
}

export type WorkspaceArtifactDrawerState = ReturnType<typeof useWorkspaceArtifactDrawerState>

export function useWorkspaceArtifactDrawerState({
  conversationId,
  sidebarCompactMode,
}: UseWorkspaceArtifactDrawerStateInput) {
  const renderers = useArtifactRenderers()
  const [artifactOwners, setArtifactOwners] = useState<Record<string, string>>({})
  const artifactRendererName = conversationId ? (artifactOwners[conversationId] ?? null) : null
  const enabled = renderers.some(({ name }) => name === artifactRendererName)
  const [artifactsVisibleByConversation, setArtifactsVisibleByConversation] = useState<
    Record<string, boolean>
  >({})
  const [artifactFullscreenConversationId, setArtifactFullscreenConversationId] = useState<
    string | null
  >(null)
  const desktopContentRef = useRef<HTMLDivElement>(null)
  const artifactDrawerRef = useRef<HTMLDivElement>(null)
  const artifactOverlayPreviousFocusRef = useRef<HTMLElement | null>(null)

  const artifactsVisible =
    enabled && conversationId ? (artifactsVisibleByConversation[conversationId] ?? false) : false
  const artifactsFullscreen = Boolean(
    enabled && conversationId && artifactFullscreenConversationId === conversationId,
  )
  const artifactDrawerVisible = artifactsVisible && !artifactsFullscreen
  const artifactDrawerOverlay = sidebarCompactMode
  const showDesktopArtifactDrawer = artifactDrawerVisible && !artifactDrawerOverlay
  const animatedDrawerPresent = useAnimatedPresence(artifactDrawerVisible)
  const artifactDrawerPresent = enabled && animatedDrawerPresent
  const artifactDrawerInsetStyle = showDesktopArtifactDrawer
    ? { right: ARTIFACT_DRAWER_WIDTH }
    : undefined
  const artifactDrawerStyle = artifactDrawerPresent
    ? { width: artifactDrawerOverlay ? '100%' : ARTIFACT_DRAWER_WIDTH }
    : undefined

  const setArtifactsFullscreen = useCallback(
    (fullscreen: boolean) => {
      setArtifactFullscreenConversationId(fullscreen && conversationId ? conversationId : null)
    },
    [conversationId],
  )

  const handleCloseArtifacts = useCallback(() => {
    if (conversationId) {
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: false,
      }))
    }
    setArtifactsFullscreen(false)
  }, [conversationId, setArtifactsFullscreen])

  const toggleArtifacts = useCallback(
    (ownerName?: string) => {
      if (!conversationId) return
      const nextOwner = ownerName ?? artifactRendererName
      if (!nextOwner) return
      setArtifactOwners((current) => ({ ...current, [conversationId]: nextOwner }))
      const nextVisible = nextOwner !== artifactRendererName || !artifactsVisible
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: nextVisible,
      }))
      if (!nextVisible) setArtifactFullscreenConversationId(null)
    },
    [artifactsVisible, conversationId, artifactRendererName],
  )

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
      if (event.type !== 'plugin-event' || !renderers.some(({ name }) => name === event.plugin))
        return
      const update = event.event
      if (
        !(
          typeof update === 'object' &&
          update !== null &&
          'type' in update &&
          'conversationId' in update
        )
      )
        return
      if (
        (update.type !== 'markdown-artifact-update' && update.type !== 'react-artifact-update') ||
        update.conversationId !== conversationId
      )
        return
      setArtifactOwners((current) => ({ ...current, [conversationId]: event.plugin }))
      setArtifactsVisibleByConversation((current) => ({
        ...current,
        [conversationId]: true,
      }))
    })
  }, [conversationId, renderers])

  useEffect(() => {
    if (!(artifactsVisible && (artifactDrawerOverlay || artifactsFullscreen))) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (settingsKeybindingLayerIsOpen()) return
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
    setArtifactsFullscreen,
  ])

  return {
    artifactRendererName,
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
