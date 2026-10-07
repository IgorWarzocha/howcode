import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import { type Dispatch, useCallback } from 'react'
import type { WorkspaceAction } from '../../../src/app/state/workspace-model'

export function useTerminalCommands({
  dispatch,
  toolkitSettings,
}: {
  dispatch: Dispatch<WorkspaceAction>
  toolkitSettings: ToolkitComponentSettings | undefined
}) {
  const handleToggleTerminal = useCallback(() => {
    if (isToolkitComponentEnabled(toolkitSettings, 'terminal'))
      dispatch({ type: 'toggle-terminal' })
  }, [dispatch, toolkitSettings])
  const handleCloseTerminalDrawer = useCallback(
    () => dispatch({ type: 'set-terminal-visible', visible: false }),
    [dispatch],
  )
  return { handleToggleTerminal, handleCloseTerminalDrawer }
}
