import { Sparkles } from 'lucide-react'
import type { ReactElement } from 'react'

export const skillsComponent = {
  id: 'skills',
  views: ['skills'],
  utility: { view: 'skills', label: 'Skills', icon: Sparkles },
  utilityViews: ['skills'],
  projectSelectionAction: 'set-selected-project',
  contribute(view: ReactElement) {
    return { skills: view }
  },
} as const
