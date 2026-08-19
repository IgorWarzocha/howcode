import { useState } from 'react'

export function useAppShellResourceScopeState() {
  const [extensionsActive, setExtensionsActive] = useState(false)
  const [skillsActive, setSkillsActive] = useState(false)

  return { extensionsActive, setExtensionsActive, setSkillsActive, skillsActive }
}
