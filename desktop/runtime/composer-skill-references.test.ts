import { describe, expect, it } from 'vitest'
import { expandDollarSkillReferences } from './composer-skill-references.ts'

const skills = [
  {
    name: 'agent-native-hardening',
    description: 'Hardening',
    filePath: '/skills/agent-native-hardening/SKILL.md',
    sourceInfo: { type: 'project' as const },
  },
  {
    name: 'skill-creator',
    description: 'Skill authoring',
    filePath: '/skills/skill-creator/SKILL.md',
    sourceInfo: { type: 'user' as const },
  },
]

describe('expandDollarSkillReferences', () => {
  it('keeps text unchanged when no known skill is referenced', () => {
    expect(expandDollarSkillReferences({ skills, text: 'please use $missing' })).toBe(
      'please use $missing',
    )
  })

  it('adds each known skill once while preserving the original request', () => {
    const request = 'use $agent-native-hardening then $skill-creator and $agent-native-hardening'
    const expanded = expandDollarSkillReferences({ skills, text: request })

    expect(expanded.match(/\$agent-native-hardening:/gu)).toHaveLength(1)
    expect(expanded.match(/\$skill-creator:/gu)).toHaveLength(1)
    expect(expanded.endsWith(request)).toBe(true)
  })
})
