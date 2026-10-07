import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  ComposerSkillReference,
  ComposerStateRequest,
} from '../../../shared/desktop-contracts.ts'
import { getBundledSkillPaths } from './bundled-skills.ts'
import { listConfiguredPiSkills } from './configured-skills.ts'
import { parseSkillFrontmatter } from './frontmatter.ts'

async function bundledSkills(directory: string): Promise<ComposerSkillReference[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const skills: ComposerSkillReference[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const filePath = path.join(directory, entry.name, 'SKILL.md')
    const markdown = await readFile(filePath, 'utf8')
    const frontmatter = parseSkillFrontmatter(markdown)
    skills.push({
      name: frontmatter.name ?? entry.name,
      description: frontmatter.description ?? '',
      filePath,
    })
  }
  return skills
}

export async function getComposerSkills(
  request: ComposerStateRequest = {},
): Promise<ComposerSkillReference[]> {
  const installed = await listConfiguredPiSkills({
    projectPath: request.projectId,
    chat: request.composerMode === 'chat',
  })
  const bundled = (await Promise.all(getBundledSkillPaths().map(bundledSkills))).flat()
  const skills = new Map<string, ComposerSkillReference>()
  for (const skill of bundled) skills.set(skill.name, skill)
  for (const skill of installed)
    skills.set(skill.displayName, {
      name: skill.displayName,
      description: skill.description ?? '',
      filePath: skill.skillFilePath,
    })
  return [...skills.values()]
}
