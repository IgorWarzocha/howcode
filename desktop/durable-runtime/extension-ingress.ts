import type { Context } from '@earendil-works/chord'
import type { Agent, Conversation, Extension } from '@earendil-works/pi-durable'
import type {
  ComposerAttachment,
  ComposerSkillReference,
  ComposerStateRequest,
} from '../../shared/desktop-contracts.ts'

type SelectedAgent = Pick<Agent, 'extensions' | 'cwd'>
type InputRequest = { text: string; attachments?: ComposerAttachment[] }

/** Durable owns tools, prompts and lifecycle. These are host ingress hooks it does not expose. */
interface ExtensionIngress {
  resourceRequest?: (agent: SelectedAgent) => ComposerStateRequest
  skills?: (request: ComposerStateRequest) => Promise<ComposerSkillReference[]>
  prepareInput?: (input: {
    conversation: Conversation
    request: InputRequest
    resources: ComposerStateRequest
    context: Context
  }) => Promise<string>
}

const ingress = new WeakMap<Extension, ExtensionIngress>()

export function withExtensionIngress<T extends Extension>(
  extension: T,
  contribution: ExtensionIngress,
): T {
  ingress.set(extension, contribution)
  return extension
}

export function getConversationResourceRequest(agent: SelectedAgent): ComposerStateRequest {
  let request: ComposerStateRequest = { directoryId: agent.cwd, composerProfile: 'coding' }
  for (const extension of agent.extensions) {
    const resolve = ingress.get(extension)?.resourceRequest
    if (resolve) request = resolve(agent)
  }
  return request
}

export async function discoverConversationSkills(agent: SelectedAgent) {
  const request = getConversationResourceRequest(agent)
  const skills = new Map<string, ComposerSkillReference>()
  for (const extension of agent.extensions) {
    const discover = ingress.get(extension)?.skills
    if (discover) for (const skill of await discover(request)) skills.set(skill.name, skill)
  }
  return [...skills.values()]
}

export async function prepareExtensionInput(
  agent: SelectedAgent,
  conversation: Conversation,
  request: InputRequest,
  context: Context,
) {
  const resources = getConversationResourceRequest(agent)
  let text = request.text
  for (const extension of agent.extensions) {
    const prepare = ingress.get(extension)?.prepareInput
    if (prepare)
      text = await prepare({ conversation, request: { ...request, text }, resources, context })
  }
  return text
}
