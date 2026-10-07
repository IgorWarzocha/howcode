import { useState } from 'react'

export function useSkillsProjectScopeState() {
  const [skillsActive, setSkillsActive] = useState(false)

  return { setSkillsActive, skillsActive }
}
