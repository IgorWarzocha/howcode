import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineExtension, section } from '@earendil-works/pi-durable'
import { mapWithConcurrency } from '../pi-threads/map-with-concurrency.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { getComposerSkills } from './discovery.ts'

async function optionalInstructions(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

async function workspaceInstructions(cwd: string) {
  const directories: string[] = []
  for (let directory = path.resolve(cwd); ; directory = path.dirname(directory)) {
    directories.unshift(directory)
    if (path.dirname(directory) === directory) break
  }
  const contents = await mapWithConcurrency(directories, 8, async (directory) => {
    const filePath = path.join(directory, 'AGENTS.md')
    const text = await optionalInstructions(filePath)
    return text ? `Instructions from ${filePath}:\n${text}` : null
  })
  return contents.filter(Boolean).join('\n\n')
}

export const Resources = defineExtension({
  name: 'howcode.resources',
  sections: [
    section('howcode-instructions', async ({ agent }) => {
      const global =
        (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.md'))) ??
        (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.MD')))
      const workspace = agent.cwd ? await workspaceInstructions(agent.cwd) : ''
      return [global, workspace].filter(Boolean).join('\n\n') || undefined
    }),
    section('skills', async ({ agent }) => {
      const chat = agent.extensions.some((extension) => extension.name === 'howcode.chat')
      const skills = await getComposerSkills({
        projectId: chat ? null : agent.cwd,
        composerMode: chat ? 'chat' : 'code',
      })
      if (skills.length === 0) return undefined
      return [
        'Available skills. Read the relevant SKILL.md before using a skill.',
        ...skills.map(
          (skill) => `- ${skill.name}: ${skill.description}\n  File: ${skill.filePath}`,
        ),
      ].join('\n')
    }),
  ],
})
