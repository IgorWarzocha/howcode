import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'
import type { View } from '../../../src/app/types'

export const workingDirectoriesComponent = {
  id: 'working-directories',
  views: ['landing', 'directories', 'directory'] satisfies View[],
  selectedConversationViews: ['directory'] satisfies View[],
  utilityViews: [] satisfies View[],
  keybindings: [] satisfies ComponentKeybindingPolicy[],
} as const
