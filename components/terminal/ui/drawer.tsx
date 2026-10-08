import { useCallback, useEffect, useState } from 'react'
import { useToolkitComponentEnabled } from '../../../src/app/component-system/component-context'
import { useAnimatedPresence } from '../../../src/app/hooks/useAnimatedPresence'
import type { View } from '../../../src/app/types'
import { cn } from '../../../src/app/utils/cn'
import type { ShellTerminalPanelProps } from './shell-terminal-panel'
import { TerminalPanel } from './terminal-panel'

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
  activeView: View
  visible: boolean
  compactMode: boolean
  hiddenByCompactResize: boolean
}) {
  const enabled = useToolkitComponentEnabled('terminal')
  const drawerVisible =
    enabled &&
    (input.activeView === 'chat' || input.activeView === 'directory') &&
    input.visible &&
    !(input.compactMode && input.hiddenByCompactResize)
  const animatedPresent = useAnimatedPresence(drawerVisible)
  const drawerPresent =
    enabled && (input.compactMode && input.hiddenByCompactResize ? drawerVisible : animatedPresent)
  return { drawerVisible, drawerPresent }
}

export function TerminalDrawerLayer({
  drawerPresent,
  drawerVisible,
  compactMode,
  ...panel
}: ShellTerminalPanelProps & {
  drawerPresent: boolean
  drawerVisible: boolean
  compactMode: boolean
}) {
  if (!drawerPresent) return null
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-0 right-0 bottom-0 z-20 max-w-full overflow-hidden',
        compactMode ? 'w-full' : 'w-[min(28rem,calc(100%_-_2.5rem))]',
      )}
    >
      <div
        data-open={drawerVisible ? 'true' : 'false'}
        className={`motion-terminal-drawer absolute inset-0 min-h-0 min-w-0 ${drawerVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <TerminalPanel {...panel} />
      </div>
    </div>
  )
}
