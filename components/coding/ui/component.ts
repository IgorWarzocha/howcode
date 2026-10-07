import type { ComponentKeybindingPolicy } from '@howcode/component-system/keybinding-policy'
import { Code2 } from 'lucide-react'
import type { ReactElement } from 'react'
import type { View } from '../../../src/app/types'

export const codingComponent = {
  id: 'coding',
  views: ['landing', 'code', 'project', 'thread', 'gitops', 'sessions'] satisfies View[],
  selectedConversationViews: ['thread', 'gitops', 'project'] satisfies View[],
  utilityViews: ['sessions'] satisfies View[],
  navigation: { view: 'code', label: 'Code', icon: Code2 },
  keybindings: [
    { id: 'gitops.open' },
    { id: 'gitops.toggleChangedFiles', renderer: true, allowFromTextInput: () => false },
  ] satisfies ComponentKeybindingPolicy[],
  contribute(view: ReactElement) {
    return Object.fromEntries(this.views.map((route) => [route, view]))
  },
} as const
