import { readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { Type } from '@earendil-works/pi-ai'
import type { Agent } from '@earendil-works/pi-durable'
import { defineExtension, defineTool } from '@earendil-works/pi-durable'
import { createReadTool } from '@earendil-works/pi-durable/tools'
import { withExtensionIngress } from '../../../desktop/durable-runtime/extension-ingress.ts'
import type { ComposerSkillReference } from '../../../shared/desktop-contracts.ts'
import {
  AttachmentGrantsDoc,
  authorizeAttachmentPath,
  resolveAttachmentGrants,
} from './attachment-grants.ts'

export { AttachmentGrantsDoc } from './attachment-grants.ts'

export function createAttachmentTools({
  discoverSkills,
}: {
  discoverSkills: (agent: Agent) => Promise<ComposerSkillReference[]>
}) {
  async function skillReadGrants(agent: Agent) {
    const skills = await discoverSkills(agent)
    return {
      files: [],
      directories: await Promise.all(skills.map((skill) => realpath(path.dirname(skill.filePath)))),
    }
  }

  async function authorizeRead(
    filePath: string,
    cwd: string,
    grants: { readonly files: readonly string[]; readonly directories: readonly string[] },
    agent: Agent,
  ) {
    const skillGrants = await skillReadGrants(agent)
    return authorizeAttachmentPath(filePath, cwd, {
      files: grants.files,
      directories: [...grants.directories, ...skillGrants.directories],
    })
  }

  const read = createReadTool()
  const attachmentRead = defineTool({
    ...read,
    async execute(args, api, context) {
      const grants = (await api.snapshot(AttachmentGrantsDoc, api.conversationId, context)) ?? {
        files: [],
        directories: [],
      }
      const resolved = await authorizeRead(
        args.path,
        api.env?.cwd ?? process.cwd(),
        grants,
        await api.agent(context),
      )
      return read.execute({ ...args, path: resolved }, api, context)
    },
  })
  const attachmentList = defineTool({
    name: 'ls',
    description: 'List files in an attached folder.',
    parameters: Type.Object({ path: Type.String() }),
    async execute(args, api, context) {
      const grants = (await api.snapshot(AttachmentGrantsDoc, api.conversationId, context)) ?? {
        files: [],
        directories: [],
      }
      const resolved = await authorizeAttachmentPath(
        args.path,
        api.env?.cwd ?? process.cwd(),
        grants,
        true,
      )
      const entries = await readdir(resolved, { withFileTypes: true })
      return {
        output: [
          {
            type: 'text',
            text: entries
              .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
              .join('\n'),
          },
        ],
      }
    },
  })

  return withExtensionIngress(
    defineExtension({
      name: 'howcode.attachments',
      tools: [attachmentRead, attachmentList],
    }),
    {
      async prepareInput({ conversation, request, context }) {
        const grants = await resolveAttachmentGrants(request.attachments ?? [])
        await conversation.commit(async (tx) => {
          const existing = await tx.doc(AttachmentGrantsDoc, conversation.id)
          existing.files = [...new Set([...existing.files, ...grants.files])]
          existing.directories = [...new Set([...existing.directories, ...grants.directories])]
        }, context)
        return request.text
      },
    },
  )
}
