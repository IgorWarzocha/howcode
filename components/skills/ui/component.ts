import { Sparkles } from 'lucide-react'
import type { ReactElement } from 'react'

export const skillsComponent = {
  id: 'skills',
  views: ['skills'],
  utility: { view: 'skills', label: 'Skills', icon: Sparkles },
  utilityViews: ['skills'],
  directorySelectionAction: 'set-selected-directory',
  contribute(view: ReactElement) {
    return { skills: view }
  },
} as const
