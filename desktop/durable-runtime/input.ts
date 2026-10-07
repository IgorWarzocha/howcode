import { open, readFile } from 'node:fs/promises'
import type { Conversation, UserInput } from '@earendil-works/pi-durable'
import { buildComposerAttachmentPrompt } from '../../shared/composer-attachment-prompt.ts'
import type { ComposerAttachment, ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { mapWithConcurrency } from '../pi-threads/map-with-concurrency.ts'
import { AttachmentGrantsDoc, resolveAttachmentGrants } from '../resources/attachment-grants.ts'
import { getComposerSkills } from '../resources/discovery.ts'
import { getDurableModels } from '../settings/models.ts'
import { loadPiSettings } from '../settings/preferences.ts'
import { runtimeContext } from './host.ts'

const externalReferencePattern = /^https?:\/\//i
const maxImageBytes = 20 * 1024 * 1024
const imageMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}
const dollarSkillTokenPattern = /(^|\s)\$([\w./-]+)/g
const skillCommandPattern = /^\/skill:([^\s]+)(?:\s|$)/
async function readImageInput(image: ComposerAttachment) {
  const extension = image.path.split('.').at(-1)?.toLowerCase()
  const mimeType = extension ? imageMimeTypes[extension] : undefined
  if (!mimeType)
    throw new Error(`Unsupported image input: ${image.name}. Use PNG, JPEG, GIF, or WebP.`)
  const file = await open(image.path, 'r')
  try {
    const metadata = await file.stat()
    if (!metadata.isFile() || metadata.size > maxImageBytes)
      throw new Error(`Image input must be a file no larger than 20 MiB: ${image.name}`)
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of file.createReadStream({
      autoClose: false,
      highWaterMark: 64 * 1024,
    })) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.byteLength
      if (size > maxImageBytes) throw new Error(`Image input exceeds 20 MiB: ${image.name}`)
      chunks.push(bytes)
    }
    const bytes = Buffer.concat(chunks, size)
    return { type: 'image' as const, mimeType, data: bytes.toString('base64') }
  } finally {
    await file.close()
  }
}

async function promptContent(text: string, attachments: ComposerAttachment[]): Promise<UserInput> {
  const images = attachments.filter(
    (attachment) => attachment.kind === 'image' && !externalReferencePattern.test(attachment.path),
  )
  const imageSet = new Set(images)
  const references = buildComposerAttachmentPrompt(
    attachments.filter((attachment) => !imageSet.has(attachment)),
  )
  const content: Exclude<UserInput, string> = [
    { type: 'text', text: [references, text].filter(Boolean).join('\n\n') },
  ]
  content.push(...(await mapWithConcurrency(images, 8, readImageInput)))

  return content
}

export async function prepareRuntimeInput(
  conversation: Conversation,
  request: ComposerStateRequest & { text: string; attachments?: ComposerAttachment[] },
) {
  const preferences = await loadPiSettings(
    request.composerMode === 'chat' ? null : request.projectId,
  )
  if (
    preferences.blockImages &&
    request.attachments?.some((attachment) => attachment.kind === 'image')
  )
    throw new Error('Image inputs are disabled in Pi settings.')
  if (request.attachments?.some((attachment) => attachment.kind === 'image')) {
    const agent = await conversation.agent(runtimeContext)
    const model = agent.model
      ? (await getDurableModels()).getModel(agent.model.provider, agent.model.modelId)
      : undefined
    if (!model?.input.includes('image'))
      throw new Error('The selected model does not support image inputs.')
  }
  const skills = await getComposerSkills(request)
  const selectedNames = new Set(
    Array.from(request.text.matchAll(dollarSkillTokenPattern), (match) => match[2]),
  )
  const commandName = skillCommandPattern.exec(request.text)?.[1]
  if (commandName) selectedNames.add(commandName)
  const selectedSkills = skills.filter((skill) => selectedNames.has(skill.name))
  const grants = await resolveAttachmentGrants(request.attachments ?? [])
  await conversation.commit(async (tx) => {
    const existing = await tx.doc(AttachmentGrantsDoc, conversation.id)
    existing.files = [...new Set([...existing.files, ...grants.files])]
    existing.directories = [...new Set([...existing.directories, ...grants.directories])]
  }, runtimeContext)
  const instructions = await Promise.all(
    selectedSkills.map(
      async (skill) =>
        `<skill name="${skill.name}">\n${await readFile(skill.filePath, 'utf8')}\n</skill>`,
    ),
  )

  return promptContent([...instructions, request.text].join('\n\n'), request.attachments ?? [])
}
