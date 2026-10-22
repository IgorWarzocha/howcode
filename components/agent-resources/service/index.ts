import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineExtension, section } from '@earendil-works/pi-durable'
import { createProjectInstructions } from '@howaboua/pi-durable-project-instructions'
import { withExtensionIngress } from '../../../desktop/durable-runtime/extension-ingress.ts'
import { getAgentDirectory } from '../../../desktop/settings/paths.ts'
import type {
  ComposerSkillReference,
  ComposerStateRequest,
} from '../../../shared/desktop-contracts.ts'
import { inlineAnswerPrompt } from './answer-prompt.ts'

async function optionalInstructions(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

const dollarSkillTokenPattern = /(^|\s)\$([\w./-]+)/g
const skillCommandPattern = /^\/skill:([^\s]+)(?:\s|$)/

export function createAgentResources(
  getComposerSkills: (request: ComposerStateRequest) => Promise<ComposerSkillReference[]>,
) {
  const projectInstructions = createProjectInstructions()
  return withExtensionIngress(
    defineExtension({
      // Keep project context under the existing, independently selected Resources capability.
      ...projectInstructions,
      name: 'howcode.resources',
      sections: [
        section('howcode-answer-presentation', () => inlineAnswerPrompt, { tag: false }),
        section(
          'howcode-global-instructions',
          async () =>
            (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.md'))) ??
            (await optionalInstructions(path.join(getAgentDirectory(), 'AGENTS.MD'))) ??
            undefined,
        ),
        ...(projectInstructions.sections ?? []),
        createSkillsSection(),
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
  function createSkillsSection() {
    return section('skills', async ({ agent }) => {
      const skills = await getComposerSkills({
        directoryId: agent.cwd,
        composerExtensions: agent.extensions.map((selected) => selected.name),
      })
      if (skills.length === 0) return undefined
      return [
        'Available skills. Read the relevant SKILL.md before using a skill.',
        ...skills.map(
          (skill) => `- ${skill.name}: ${skill.description}\n  File: ${skill.filePath}`,
        ),
      ].join('\n')
    })
  }
}
