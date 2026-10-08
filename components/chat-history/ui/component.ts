import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'
import type { View } from '../../../src/app/types'

export const chatHistoryComponent = {
  id: 'chat-history',
  views: ['history'] satisfies View[],
  selectedConversationViews: [] satisfies View[],
  utilityViews: ['history'] satisfies View[],
  keybindings: [] satisfies ComponentKeybindingPolicy[],
} as const
