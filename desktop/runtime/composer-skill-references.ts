import type { ComposerSkillReference } from '../../shared/desktop-contracts.ts'
import type { PiRuntime } from './types.ts'

const dollarSkillTokenPattern = /(^|\s)\$([\w./-]+)/g

export function mapSessionSkills(session: PiRuntime['session']): ComposerSkillReference[] {
  return session.resourceLoader.getSkills().skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    filePath: skill.filePath,
    sourceInfo: skill.sourceInfo,
  }))
}

export function buildSkillReferencePrompt(input: {
  skills: ComposerSkillReference[]
  userRequest: string
}) {
  return [
    'The user asked you to use the following skills. Read their SKILL.md files if available.',
    '',
    ...input.skills.map((skill) => `- $${skill.name}: ${skill.filePath}`),
    '',
    'User request:',
    input.userRequest,
  ].join('\n')
}

export function expandDollarSkillReferences(input: {
  skills: ComposerSkillReference[]
  text: string
}) {
  const skillsByName = new Map(input.skills.map((skill) => [skill.name, skill]))
  const skills: ComposerSkillReference[] = []
  const seenSkillNames = new Set<string>()

  for (const match of input.text.matchAll(dollarSkillTokenPattern)) {
    const skillName = match[2]
    if (!skillName || seenSkillNames.has(skillName)) continue
    const skill = skillsByName.get(skillName)
    if (!skill) continue
    seenSkillNames.add(skillName)
    skills.push(skill)
  }

  if (skills.length === 0) return input.text

  return buildSkillReferencePrompt({
    skills,
    userRequest: input.text,
  })
}

export function expandRuntimeDollarSkillReferences(runtime: PiRuntime, text: string) {
  return expandDollarSkillReferences({
    skills: mapSessionSkills(runtime.session),
    text,
  })
}
