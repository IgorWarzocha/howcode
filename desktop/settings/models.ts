import path from 'node:path'
import type { AuthInteraction, AuthType, Models } from '@earendil-works/pi-ai'
import { builtinModels } from '@earendil-works/pi-ai/providers/all'
import type { ComposerModel } from '../../shared/desktop-contracts.ts'
import { FileCredentialStore } from './credentials.ts'
import { getAgentDirectory } from './paths.ts'
import { applyProviderConfiguration } from './provider-config.ts'

let current: { directory: string; models: Models } | undefined

export async function getDurableModels(): Promise<Models> {
  const directory = getAgentDirectory()
  if (current?.directory !== directory) {
    const models = builtinModels({
      credentials: new FileCredentialStore(path.join(directory, 'auth.json')),
    })
    await applyProviderConfiguration(models, directory)
    current = {
      directory,
      models,
    }
  }
  return current.models
}

export async function getComposerModels(): Promise<ComposerModel[]> {
  const models = await getDurableModels()
  return (await models.getAvailable()).map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name,
    reasoning: Boolean(model.reasoning),
    input: [...model.input],
  }))
}

export async function loginProvider(
  providerId: string,
  type: AuthType,
  interaction: AuthInteraction,
) {
  return (await getDurableModels()).login(providerId, type, interaction)
}

export async function logoutProvider(providerId: string) {
  await (await getDurableModels()).logout(providerId)
}
