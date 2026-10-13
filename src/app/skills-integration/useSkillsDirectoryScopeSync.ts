import { useEffect } from 'react'
import { shouldResetDirectoryScope } from '../app-shell/scoped-directory-view'
import type { View } from '../types'

export function useSkillsDirectoryScopeSync({
  activeView,
  setSkillsDirectoryScopeActive,
  skillsDirectoryScopeActive,
}: {
  activeView: View
  setSkillsDirectoryScopeActive: (active: boolean) => void
  skillsDirectoryScopeActive: boolean
}) {
  useEffect(() => {
    if (skillsDirectoryScopeActive && shouldResetDirectoryScope(activeView, 'skills'))
      setSkillsDirectoryScopeActive(false)
  }, [activeView, setSkillsDirectoryScopeActive, skillsDirectoryScopeActive])
}
