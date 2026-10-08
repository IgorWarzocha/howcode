import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'
import type { ReactElement } from 'react'
import type { View } from '../../../src/app/types'

export const codingComponent = {
  id: 'coding',
  views: ['landing', 'directories', 'directory', 'gitops', 'history'] satisfies View[],
  selectedConversationViews: ['gitops', 'directory'] satisfies View[],
  utilityViews: ['history'] satisfies View[],
  keybindings: [
    { id: 'gitops.open' },
    { id: 'gitops.toggleChangedFiles', renderer: true, allowFromTextInput: () => false },
  ] satisfies ComponentKeybindingPolicy[],
  contribute(view: ReactElement) {
    return Object.fromEntries(this.views.map((route) => [route, view]))
  },
} as const
