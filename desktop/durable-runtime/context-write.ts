import type { Context } from '@earendil-works/chord'
import { withAbortSignal } from '@earendil-works/chord/context'
import type { Conversation } from '@earendil-works/pi-durable'
import type { PluginConversations } from '@howaboua/howcode-sdk/plugins'
import { HarnessContextEntry } from '../../shared/harness-context.ts'
import { getDurableModels } from '../settings/models.ts'
import { getDurableRuntime, resolveConversation, runtimeContext } from './host.ts'

type ContextWrite = Parameters<PluginConversations['writeContext']>[0]

async function rejoinContextWrite(
  conversation: Conversation,
  requestId: string | undefined,
  context: Context,
) {
  if (requestId === undefined) return undefined
  const existing = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, requestId),
    context,
  )
  if (!existing) return undefined
  if (existing.type !== 'write') throw new Error('The context request belongs to native input.')
  if (existing.status === 'done' || existing.status === 'unanswered') return existing
  const submission = await (await getDurableRuntime()).submission(existing.id, context)
  if (!submission) throw new Error('The native context receipt is missing.')
  return submission.wait(context)
}

async function contextMessageRole(conversation: Conversation, context: Context) {
  const [agent, models] = await Promise.all([conversation.agent(context), getDurableModels()])
  const model = agent.model ? models.getModel(agent.model.provider, agent.model.modelId) : undefined
  if (!model) return 'user' as const
  const supportsSystem =
    [
      'openai-completions',
      'openai-responses',
      'azure-openai-responses',
      'openai-codex-responses',
      'mistral-conversations',
    ].includes(model.api) &&
    model.compat &&
    'supportsMidConvoSystemMessages' in model.compat &&
    model.compat.supportsMidConvoSystemMessages === true
  return supportsSystem ? ('system' as const) : ('user' as const)
}

/** Rejoin native receipts before association validation; passive settlement keeps its admission. */
export async function writeRuntimeContext(input: ContextWrite, validate: () => Promise<void>) {
  const { conversationId, sourceConversationId, label, text, requestId, signal } = input
  const context = signal ? withAbortSignal(signal, runtimeContext) : runtimeContext
  const conversation = await resolveConversation(conversationId)
  const existing = await rejoinContextWrite(conversation, requestId, context)
  if (existing) return existing
  await validate()
  const role = await contextMessageRole(conversation, context)
  const content = `Harness context: ${label}\nSource conversation: ${sourceConversationId}\n\n${text}`
  const submission = await conversation.submit(
    {
      type: 'write',
      ...(requestId === undefined ? {} : { requestId }),
      entry: {
        kind: HarnessContextEntry.kind,
        data: { sourceConversationId, label, text },
        model: [{ role, content, timestamp: Date.now() }],
      },
    },
    context,
  )
  return submission.wait(context)
}
