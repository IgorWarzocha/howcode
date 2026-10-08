import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'
import type { View } from '../../../src/app/types'

export const gitComponent = {
  id: 'git',
  views: ['gitops'] satisfies View[],
  selectedConversationViews: ['gitops'] satisfies View[],
  utilityViews: [] satisfies View[],
  keybindings: [
    { id: 'gitops.open' },
    { id: 'gitops.toggleChangedFiles', renderer: true, allowFromTextInput: () => false },
  ] satisfies ComponentKeybindingPolicy[],
} as const
