import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { createModels } from '@earendil-works/pi-ai/models'
import { Harness, MemoryStorage } from '@earendil-works/pi-durable'
import { describe, expect, it } from 'vitest'
import { AttachmentGrantsDoc } from '../../components/chat-tools/service/index.ts'
import {
  createDesktopExtensionRegistry,
  resolveDesktopExtensions,
} from './extension-composition.ts'
import { prepareExtensionInput } from './extension-ingress.ts'

describe('selected extension input policy', () => {
  it('only admits grants when the attachment owner is selected, and merges grants idempotently', async () => {
    const context = BACKGROUND_CONTEXT
    const registry = createDesktopExtensionRegistry()
    const harness = await Harness.open(
      new MemoryStorage(),
      { models: createModels(), registry },
      context,
    )
    const directory = await mkdtemp(path.join(tmpdir(), 'howcode-ingress-'))
    try {
      const file = path.join(directory, 'attached.txt')
      await writeFile(file, 'context')
      const conversation = await harness.root(context, { agent: { extensions: [] } })
      const request = {
        text: '$not-a-skill',
        attachments: [{ path: file, kind: 'text' as const, name: 'attached' }],
      }
      const empty = await conversation.agent(context)
      expect(await prepareExtensionInput(empty, conversation, request, context)).toBe(request.text)
      expect(await harness.snapshot(AttachmentGrantsDoc, conversation.id, context)).toBeUndefined()

      // Artifacts alone must not inherit attachment access or skill input processing.
      await conversation.configure(
        resolveDesktopExtensions({ composerExtensions: ['howcode.artifacts'] }, registry),
        context,
      )
      expect(
        await prepareExtensionInput(
          await conversation.agent(context),
          conversation,
          request,
          context,
        ),
      ).toBe(request.text)
      expect(await harness.snapshot(AttachmentGrantsDoc, conversation.id, context)).toBeUndefined()

      await conversation.configure(
        resolveDesktopExtensions({ composerExtensions: ['howcode.chat'] }, registry),
        context,
      )
      const chat = await conversation.agent(context)
      await prepareExtensionInput(chat, conversation, request, context)
      await prepareExtensionInput(chat, conversation, request, context)
      expect(await harness.snapshot(AttachmentGrantsDoc, conversation.id, context)).toEqual({
        files: [file],
        directories: [],
      })
    } finally {
      await harness.close(context)
      await rm(directory, { recursive: true, force: true })
    }
  })
})
