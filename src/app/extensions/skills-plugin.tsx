import type { ReactElement } from 'react'

export const skillsPlugin = {
  id: 'skills',
  views: ['skills'],
  contribute(view: ReactElement) {
    return { skills: view }
  },
} as const
