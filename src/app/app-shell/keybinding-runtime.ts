import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import type { MutableRefObject } from 'react'
import type { AppShellController } from './useAppShellController'

export type ChatCycleSelection = {
  directoryId: string
  chatId: string
  conversationId: string | null
  view: 'chat'
}

export type KeybindingRuntime = {
  acceleratorToCommand: Map<string, KeybindingCommandId>
  appController: AppShellController
  cycleSelectionRef: MutableRefObject<ChatCycleSelection | null>
  onToggleSidebar: () => void
  onOpenSidebar: () => void
  onFocusComposer: () => void
  onFocusTerminal: () => void
}
