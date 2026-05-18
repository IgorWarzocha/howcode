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
    expect(
      expandDollarSkillReferences({
        skills,
        text: 'use $agent-native-hardening then $skill-creator and $agent-native-hardening',
      }),
    ).toMatchInlineSnapshot(`
      "The user asked you to use the following skills. Read their SKILL.md files if available.

      - $agent-native-hardening: /skills/agent-native-hardening/SKILL.md
      - $skill-creator: /skills/skill-creator/SKILL.md

      User request:
      use $agent-native-hardening then $skill-creator and $agent-native-hardening"
    `)
  })
})
