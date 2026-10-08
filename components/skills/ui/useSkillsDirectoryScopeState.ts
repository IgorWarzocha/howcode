import { useState } from 'react'

export function useSkillsDirectoryScopeState() {
  const [skillsActive, setSkillsActive] = useState(false)

  return { setSkillsActive, skillsActive }
}
