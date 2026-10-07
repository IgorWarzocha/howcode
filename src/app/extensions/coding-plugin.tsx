import { Code2 } from 'lucide-react'
import type { ReactElement } from 'react'
import type { View } from '../types'

export const codingPlugin = {
  id: 'coding',
  views: ['landing', 'code', 'project', 'thread', 'gitops', 'sessions'] satisfies View[],
  navigation: { view: 'code', label: 'Code', icon: Code2 },
  contribute(view: ReactElement) {
    return Object.fromEntries(this.views.map((route) => [route, view]))
  },
} as const
