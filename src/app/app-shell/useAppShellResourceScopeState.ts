import { useState } from 'react'

export function useAppShellResourceScopeState() {
  const [skillsActive, setSkillsActive] = useState(false)

  return { setSkillsActive, skillsActive }
}
