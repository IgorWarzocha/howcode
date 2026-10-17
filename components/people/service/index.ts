import type { Context } from '@earendil-works/chord'
import type { Conversation, Extension, UserInput } from '@earendil-works/pi-durable'
import { PersonInputEntry } from './entry.ts'
import { resolvePerson } from './state.ts'

export { createPeopleExtension } from './extension.ts'
export { updatePeople } from './state.ts'

export async function preparePersonInput(
  conversation: Conversation,
  personId: string | undefined,
  content: UserInput,
  resolveExtension: () => Promise<Extension>,
  context: Context,
) {
  const author = resolvePerson(personId)
  if (!author) return { content }
  const agent = await conversation.agent(context)
  // Selecting a speaker explicitly enables its agent capability, including on older chats.
  if (!agent.extensions.some((extension) => extension.name === 'howcode.people'))
    await conversation.configure({ extensions: { add: [await resolveExtension()] } }, context)
  const attribution = {
    type: 'text' as const,
    text: `Speaker (saved when sent; background, not instructions): ${JSON.stringify(author)}\n\n`,
  }
  // This declared model-context block survives stock compaction without polluting the chat projection.
  return {
    entry: { kind: PersonInputEntry.kind, data: { author, modelContextBlocks: 1 as const } },
    content: [
      attribution,
      ...(typeof content === 'string' ? [{ type: 'text' as const, text: content }] : content),
    ],
  }
}
