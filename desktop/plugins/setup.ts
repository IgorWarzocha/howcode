import path from 'node:path'
import type { PluginSetupHost, SetupLaunchFacts } from '@howaboua/howcode-sdk/setup-host'
import { resolveConversation, runtimeContext } from '../durable-runtime/host.ts'
import { submitSetupInput } from '../durable-runtime/input-ingress.ts'
import { getDurableModels } from '../settings/models.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { resolveInstalledWorkspaceAgent } from './runtime.ts'

export function createPluginSetupHost(
  launch: Pick<SetupLaunchFacts, 'executable' | 'args' | 'environment' | 'cwd'> | undefined,
): PluginSetupHost {
  const standalone = launch
    ? { ...launch, args: [...launch.args], environment: { ...launch.environment } }
    : undefined
  return {
    begin: (input) =>
      submitSetupInput(input, async () => {
        const resident = await resolveInstalledWorkspaceAgent()
        if (
          resident?.role !== 'installation' ||
          resident.mainConversationId !== input.conversationId ||
          input.requestId !== `howcode-setup:${resident.familyAnchorConversationId}`
        )
          throw new Error('Setup input must target the continuing installation assistant.')
      }),
    models: async () =>
      (await (await getDurableModels()).getAvailable()).map(({ provider, id, name }) => ({
        provider,
        modelId: id,
        name,
      })),
    selectModel: async ({ conversationId, provider, modelId }) => {
      const models = await (await getDurableModels()).getAvailable()
      if (!models.some((model) => model.provider === provider && model.id === modelId))
        throw new Error('Selected model is not available. Configure model access first.')
      const conversation = await resolveConversation(conversationId)
      await conversation.configure({ model: { provider, modelId } }, runtimeContext)
    },
    launchFacts: async () => {
      if (!standalone) throw new Error('Standalone launch facts are unavailable for this runtime.')
      return {
        executable: standalone.executable,
        args: [...standalone.args],
        environment: { ...standalone.environment },
        cwd: standalone.cwd,
        profileDirectory: path.resolve(getDesktopUserDataPath()),
        agentDirectory: getAgentDirectory(),
        platform: process.platform,
      }
    },
  }
}
