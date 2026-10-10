import type { PluginRequest } from '@howaboua/howcode-sdk/plugins'
import { createArtifactsHandlers } from '../../../components/artifacts/host/index'
import { createDictationHandlers } from '../../../components/dictation/host/index'
import { createPiSkillsHandlers } from '../../../components/skills/host/index'
import { createTerminalHandlers } from '../../../components/terminal/host/index'
import { createWorkingDirectoriesHandlers } from '../../../components/working-directories/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { installedHostContributions } from './installed-hosts.generated'

// Built-in host contributions remain available independently of UI presentation
// and Durable's persisted agent tool selection.
export function createToolkitHostComponents(
  runtime: DesktopServiceRuntime,
  listDirectoryDirectoryEntries: DesktopRequestHandlerMap['listDirectoryDirectoryEntries'],
) {
  const pluginHandlers: Record<string, unknown> = {}
  for (const [name, contribution] of Object.entries(installedHostContributions)) {
    const request: PluginRequest = async <Result>(
      method: string,
      payload: unknown,
    ): Promise<Result> => (await runtime.plugins.request(name, method, payload)) as Result
    const handlers = contribution.create({ request })
    for (const [method, handler] of Object.entries(handlers)) {
      if (Object.hasOwn(pluginHandlers, method))
        throw new Error(`Duplicate installed plugin request: ${method}`)
      pluginHandlers[method] = handler
    }
  }
  return {
    workingDirectories: createWorkingDirectoriesHandlers(
      runtime.workingDirectories,
      listDirectoryDirectoryEntries,
    ),
    plugins: pluginHandlers as Pick<
      DesktopRequestHandlerMap,
      keyof import('@howaboua/howcode-git/host/contracts').GitRequestMap
    >,
    async pluginRequest({
      plugin,
      method,
      payload,
    }: {
      plugin: string
      method: string
      payload: unknown
    }) {
      return runtime.plugins.hostRequest(plugin, method, payload)
    },
    terminal: createTerminalHandlers(runtime.terminalManager),
    artifacts: createArtifactsHandlers(runtime.artifacts),
    skills: createPiSkillsHandlers(runtime.skills),
    dictation: createDictationHandlers(runtime.dictation),
  }
}
