import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineExtension, section } from '@earendil-works/pi-durable'
import { withExtensionIngress } from '../durable-runtime/extension-ingress.ts'
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

const dollarSkillTokenPattern = /(^|\s)\$([\w./-]+)/g
const skillCommandPattern = /^\/skill:([^\s]+)(?:\s|$)/

export const Resources = withExtensionIngress(
  defineExtension({
    name: 'howcode.resources',
    sections: [
      section('howcode-instructions', async ({ agent }) => {
        const global =
          (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.md'))) ??
          (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.MD')))
        const workspace = agent.cwd ? await workspaceInstructions(agent.cwd) : ''
        return [global, workspace].filter(Boolean).join('\n\n') || undefined
      }),
      createSkillsSection('workspace'),
    ],
  }),
  {
    skills: getComposerSkills,
    async prepareInput({ request, resources }) {
      const selectedNames = new Set(
        Array.from(request.text.matchAll(dollarSkillTokenPattern), (match) => match[2]),
      )
      const commandName = skillCommandPattern.exec(request.text)?.[1]
      if (commandName) selectedNames.add(commandName)
      if (selectedNames.size === 0) return request.text
      const skills = await getComposerSkills(resources)
      const instructions = await Promise.all(
        skills
          .filter((skill) => selectedNames.has(skill.name))
          .map(
            async (skill) =>
              `<skill name="${skill.name}">\n${await readFile(skill.filePath, 'utf8')}\n</skill>`,
          ),
      )
      return [...instructions, request.text].join('\n\n')
    },
  },
)

/** Resource discovery is explicit extension behavior, not a name check on the agent. */
export function createSkillsSection(scope: 'chat' | 'workspace') {
  return section('skills', async ({ agent }) => {
    const skills = await getComposerSkills({
      projectId: scope === 'chat' ? null : agent.cwd,
      composerMode: scope === 'chat' ? 'chat' : 'code',
    })
    if (skills.length === 0) return undefined
    return [
      'Available skills. Read the relevant SKILL.md before using a skill.',
      ...skills.map((skill) => `- ${skill.name}: ${skill.description}\n  File: ${skill.filePath}`),
    ].join('\n')
  })
}
