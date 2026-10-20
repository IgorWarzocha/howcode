import { getSupportedThinkingLevels } from '@earendil-works/pi-ai'
import type { PluginSetupHost, SetupModel } from '@howaboua/howcode-sdk/setup-host'
import { getDurableModels } from '../settings/models.ts'
import { resolveConversation, runtimeContext } from './host.ts'

export async function getAvailableSetupModels(): Promise<SetupModel[]> {
  return (await (await getDurableModels()).getAvailable()).map((model) => ({
    provider: model.provider,
    modelId: model.id,
    name: model.name,
    thinkingLevels: getSupportedThinkingLevels(model),
  }))
}

export async function selectSetupModel({
  conversationId,
  provider,
  modelId,
  thinkingLevel,
}: Parameters<PluginSetupHost['selectModel']>[0]) {
  const models = await (await getDurableModels()).getAvailable()
  const model = models.find((entry) => entry.provider === provider && entry.id === modelId)
  if (!model) throw new Error('Selected model is not available. Configure model access first.')
  if (thinkingLevel !== undefined && !getSupportedThinkingLevels(model).includes(thinkingLevel))
    throw new Error('Selected reasoning level is not available for this model.')
  const conversation = await resolveConversation(conversationId)
  await conversation.configure(
    {
      model: { provider, modelId },
      ...(thinkingLevel === undefined ? {} : { thinkingLevel }),
    },
    runtimeContext,
  )
}
