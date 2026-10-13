import { useAnimatedPresence } from '@howaboua/howcode-sdk/hooks/useAnimatedPresence'
import type { TerminalRendererPort } from '@howaboua/howcode-sdk/terminal-renderer'
import { type Dispatch, useCallback, useEffect, useState } from 'react'
import { piGuiThemeUpdatedEvent } from '../../shared/gui-theme'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '../../shared/toolkit-components'
import { useInstalledRendererContributions } from './component-system/installed-component-catalog'
import { openExternalQuery } from './query/desktop-query'
import { terminalClient } from './terminal-client'

/** The shell owns transport and saved visibility; the installed renderer owns native UI. */
export const terminalRendererPort = {
  client: terminalClient,
  openExternal: openExternalQuery,
  subscribeTheme(listener) {
    window.addEventListener(piGuiThemeUpdatedEvent, listener)
    return () => window.removeEventListener(piGuiThemeUpdatedEvent, listener)
  },
} satisfies TerminalRendererPort

export function useTerminalEnabled(settings: ToolkitComponentSettings | undefined) {
  return (
    Boolean(useInstalledRendererContributions()['@howaboua/howcode-terminal']) &&
    isToolkitComponentEnabled(settings, 'terminal')
  )
}

export function useTerminalCommands({
  dispatch,
  enabled,
}: {
  dispatch: Dispatch<
    { type: 'toggle-terminal' } | { type: 'set-terminal-visible'; visible: boolean }
  >
  enabled: boolean
}) {
  return {
    handleToggleTerminal: useCallback(() => {
      if (enabled) dispatch({ type: 'toggle-terminal' })
    }, [dispatch, enabled]),
    handleCloseTerminalDrawer: useCallback(
      () => dispatch({ type: 'set-terminal-visible', visible: false }),
      [dispatch],
    ),
  }
}

export function useTerminalResponsiveState(visible: boolean, close: () => void) {
  const [hiddenByCompactResize, setHiddenByCompactResize] = useState(false)
  useEffect(() => {
    if (!visible) setHiddenByCompactResize(false)
  }, [visible])
  const onEnterCompact = useCallback(() => {
    if (!visible) return
    setHiddenByCompactResize(true)
    close()
  }, [close, visible])
  const closeOnComposerFocus = useCallback(() => {
    if (visible) close()
  }, [close, visible])
  return { hiddenByCompactResize, onEnterCompact, closeOnComposerFocus }
}

export function useTerminalDrawerPresentation(input: {
  enabled: boolean
  activeView: string
  visible: boolean
  compactMode: boolean
  hiddenByCompactResize: boolean
}) {
  const drawerVisible =
    input.enabled &&
    (input.activeView === 'chat' || input.activeView === 'directory') &&
    input.visible &&
    !(input.compactMode && input.hiddenByCompactResize)
  const animatedPresent = useAnimatedPresence(drawerVisible)
  const drawerPresent =
    input.enabled &&
    (input.compactMode && input.hiddenByCompactResize ? drawerVisible : animatedPresent)
  return { drawerVisible, drawerPresent }
}
