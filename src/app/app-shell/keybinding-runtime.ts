import type { MutableRefObject } from 'react'
import type { KeybindingCommandId } from '../../../shared/keybindings'
import type { AppShellController } from './useAppShellController'

export type ThreadCycleSelection = {
  projectId: string
  threadId: string
  sessionPath: string | null
  view: 'chat' | 'thread'
}

export type KeybindingRuntime = {
  acceleratorToCommand: Map<string, KeybindingCommandId>
  appController: AppShellController
  cycleSelectionRef: MutableRefObject<ThreadCycleSelection | null>
  onToggleSidebar: () => void
  onOpenSidebar: () => void
}
