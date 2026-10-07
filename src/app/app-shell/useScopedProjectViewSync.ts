import { useEffect } from 'react'
import type { View } from '../types'
import { shouldResetProjectScope } from './scoped-project-view'

export function useScopedProjectViewSync({
  activeView,
  setSkillsProjectScopeActive,
  skillsProjectScopeActive,
}: {
  activeView: View
  setSkillsProjectScopeActive: (active: boolean) => void
  skillsProjectScopeActive: boolean
}) {
  useEffect(() => {
    if (skillsProjectScopeActive && shouldResetProjectScope(activeView, 'skills'))
      setSkillsProjectScopeActive(false)
  }, [activeView, setSkillsProjectScopeActive, skillsProjectScopeActive])
}
