import { useEffect } from 'react'
import { shouldResetProjectScope } from '../../../src/app/app-shell/scoped-project-view'
import type { View } from '../../../src/app/types'

export function useSkillsProjectScopeSync({
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
