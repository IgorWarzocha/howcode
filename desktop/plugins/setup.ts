import path from 'node:path'
import type { PluginSetupHost, SetupLaunchFacts } from '@howaboua/howcode-sdk/setup-host'
import { submitSetupInput } from '../durable-runtime/input-ingress.ts'
import { getAvailableSetupModels, selectSetupModel } from '../durable-runtime/setup-models.ts'
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
    models: getAvailableSetupModels,
    selectModel: selectSetupModel,
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
