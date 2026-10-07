import { readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { Type } from '@earendil-works/pi-ai'
import { defineExtension, defineTool, section, wrapSection } from '@earendil-works/pi-durable'
import { createReadTool } from '@earendil-works/pi-durable/tools'
import { withExtensionIngress } from '../durable-runtime/extension-ingress.ts'
import { artifactTools } from './artifacts.ts'
import {
  AttachmentGrantsDoc,
  authorizeAttachmentPath,
  resolveAttachmentGrants,
} from './attachment-grants.ts'
import { renderChatPrompt } from './chat-prompt.ts'
import { getComposerSkills } from './discovery.ts'
import { createSkillsSection } from './instructions.ts'

async function skillReadGrants() {
  const skills = await getComposerSkills({ composerMode: 'chat' })
  return {
    files: [],
    directories: await Promise.all(skills.map((skill) => realpath(path.dirname(skill.filePath)))),
  }
}

async function authorizeChatRead(
  filePath: string,
  cwd: string,
  grants: { readonly files: readonly string[]; readonly directories: readonly string[] },
) {
  const skillGrants = await skillReadGrants()
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
    const resolved = await authorizeChatRead(args.path, api.env?.cwd ?? process.cwd(), grants)
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
      content: [
        {
          type: 'text',
          text: entries.map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`).join('\n'),
        },
      ],
    }
  },
})

export const ChatTools = withExtensionIngress(
  defineExtension({
    name: 'howcode.chat',
    tools: [attachmentRead, attachmentList, ...artifactTools],
    sections: [
      section('howcode-chat', ({ agent }) => renderChatPrompt(agent.instructions), { tag: false }),
    ],
    wraps: [wrapSection('skills', () => createSkillsSection('chat'))],
  }),
  {
    resourceRequest: () => ({ projectId: null, composerMode: 'chat' }),
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
