import { type Api, getSupportedThinkingLevels, type Model } from '@earendil-works/pi-ai'
import { type ContextView, InboxDoc, type InboxState, LiveDoc } from '@earendil-works/pi-durable'
import { getPersistedConversationId } from '../../shared/conversation-ids.ts'
import type {
  ComposerState,
  ComposerStateRequest,
  ComposerThinkingLevel,
} from '../../shared/desktop-contracts.ts'
import { getComposerModels, getDurableModels } from '../settings/models.ts'
import { getComposerDefaults } from './defaults.ts'
import { discoverConversationSkills } from './extension-ingress.ts'
import {
  getDurableRuntime,
  resolveConversation,
  resolveRuntimeExtensions,
  runtimeContext,
} from './host.ts'

export async function getComposerSkills(request: ComposerStateRequest = {}) {
  const conversationId = getPersistedConversationId(request.conversationId)
  const agent = conversationId
    ? await (await resolveConversation(conversationId)).agent(runtimeContext)
    : {
        ...resolveRuntimeExtensions(request),
        ...(request.projectId ? { cwd: request.projectId } : {}),
      }
  return discoverConversationSkills(agent)
}

function queuedPrompts(inbox: Readonly<InboxState> | undefined) {
  return (inbox?.items ?? []).flatMap((item) =>
    item.mode === 'write'
      ? []
      : [
          {
            id: String(item.id),
            mode: item.mode,
            text:
              typeof item.content === 'string'
                ? item.content
                : item.content
                    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
                    .join('\n'),
          },
        ],
  )
}

function contextUsage(
  context: ContextView | null,
  model: Model<Api> | undefined,
): ComposerState['contextUsage'] {
  if (!model || model.contextWindow <= 0) return null
  const marker = context?.entries.findLast((entry) => entry.head !== undefined)
  const messages = (context?.entries ?? [])
    .filter((entry) => !marker || entry.id > marker.id)
    .flatMap((entry) => entry.model ?? [])
  const assistant = messages.findLast(
    (message) =>
      message.role === 'assistant' &&
      message.stopReason !== 'error' &&
      message.stopReason !== 'aborted',
  )
  const usage = assistant?.role === 'assistant' ? assistant.usage : undefined
  const tokens = usage ? usage.input + usage.output + usage.cacheRead + usage.cacheWrite : null
  const input = usage ? usage.input + usage.cacheRead + usage.cacheWrite : 0
  return {
    tokens,
    contextWindow: model.contextWindow,
    percent: tokens === null ? null : (tokens / model.contextWindow) * 100,
    latestCacheHitRate: usage && input > 0 ? (usage.cacheRead / input) * 100 : null,
  }
}

export async function getComposerState(request: ComposerStateRequest = {}): Promise<ComposerState> {
  const availableModels = await getComposerModels()
  const defaults = getComposerDefaults(request)
  const conversationId = getPersistedConversationId(request.conversationId)
  const conversation = conversationId ? await resolveConversation(conversationId) : null
  const agent = conversation ? await conversation.agent(runtimeContext) : null
  const harness = await getDurableRuntime()
  const inbox = conversation
    ? await harness.snapshot(InboxDoc, conversation.id, runtimeContext)
    : undefined
  const live = conversation
    ? await harness.snapshot(LiveDoc, conversation.id, runtimeContext)
    : undefined
  const selected = agent?.model ?? defaults.model
  const currentModel = selected
    ? (availableModels.find(
        (model) => model.provider === selected.provider && model.id === selected.modelId,
      ) ?? null)
    : (availableModels[0] ?? null)
  const nativeModel = currentModel
    ? (await getDurableModels()).getModel(currentModel.provider, currentModel.id)
    : undefined
  const thinkingLevels = nativeModel ? getSupportedThinkingLevels(nativeModel) : ['off' as const]
  const context = conversation ? await conversation.context(runtimeContext) : null
  return {
    currentModel,
    availableModels,
    currentThinkingLevel: agent?.thinkingLevel ?? defaults.thinkingLevel,
    availableThinkingLevels: thinkingLevels,
    queuedPrompts: queuedPrompts(inbox),
    contextUsage: contextUsage(context, nativeModel),
    isCompacting: Boolean(live?.compactions?.length),
  }
}

export async function setComposerModel(
  request: ComposerStateRequest,
  provider: string,
  modelId: string,
) {
  if (request.conversationId)
    await (await resolveConversation(request.conversationId)).configure(
      { model: { provider, modelId } },
      runtimeContext,
    )
  return getComposerState({ ...request, composerModelSelection: { provider, id: modelId } })
}

export async function setComposerThinkingLevel(
  request: ComposerStateRequest,
  level: ComposerThinkingLevel,
) {
  if (request.conversationId)
    await (await resolveConversation(request.conversationId)).configure(
      { thinkingLevel: level },
      runtimeContext,
    )
  return getComposerState({ ...request, composerThinkingLevel: level })
}
