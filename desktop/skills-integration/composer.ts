import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { configuredSkills, parseSkillFrontmatter } from '@howaboua/howcode-skills/inventory'
import type {
  ComposerSkillReference,
  ComposerStateRequest,
} from '../../shared/desktop-contracts.ts'
import { installedSkillResources } from '../plugins/runtime.ts'
import { skillsPathsHost } from './paths.ts'

async function bundledSkills(directory: string): Promise<ComposerSkillReference[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name, 'SKILL.md')
        const markdown = await readFile(filePath, 'utf8')
        const frontmatter = parseSkillFrontmatter(markdown)
        return {
          name: frontmatter.name ?? entry.name,
          description: frontmatter.description ?? '',
          filePath,
        }
      }),
  )
}

export async function getComposerSkills(
  request: ComposerStateRequest = {},
): Promise<ComposerSkillReference[]> {
  const installed = await configuredSkills(skillsPathsHost, {
    directoryPath: request.directoryId,
  })
  // biome-ignore lint/complexity/useLiteralKeys: process.env has an index signature.
  const bundledDirectory = process.env['HOWCODE_BUNDLED_SKILLS_PATH']?.trim()
  const bundled = bundledDirectory ? await bundledSkills(bundledDirectory) : []
  const skills = new Map<string, ComposerSkillReference>()
  for (const skill of bundled) skills.set(skill.name, skill)
  for (const skill of installedSkillResources(request.composerExtensions))
    skills.set(skill.name, {
      name: skill.name,
      description: skill.description,
      filePath: skill.filePath,
    })
  for (const skill of installed)
    skills.set(skill.displayName, {
      name: skill.displayName,
      description: skill.description ?? '',
      filePath: skill.skillFilePath,
    })
  return [...skills.values()]
}
