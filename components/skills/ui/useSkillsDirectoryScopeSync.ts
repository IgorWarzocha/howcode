import { useEffect } from 'react'
import { shouldResetDirectoryScope } from '../../../src/app/app-shell/scoped-directory-view'
import type { View } from '../../../src/app/types'

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
