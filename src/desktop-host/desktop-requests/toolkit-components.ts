import { createTerminalHandlers } from '@howaboua/howcode-terminal/host'
import { createWorkingDirectoriesHandlers } from '../../../components/working-directories/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createPiSkillsHandlers } from './skills'

// Existing typed transport channels resolve the admitted profile generation.
export function createToolkitHostComponents(
  runtime: DesktopServiceRuntime,
  listDirectoryDirectoryEntries: DesktopRequestHandlerMap['listDirectoryDirectoryEntries'],
) {
  return {
    workingDirectories: createWorkingDirectoriesHandlers(
      runtime.workingDirectories,
      listDirectoryDirectoryEntries,
    ),
    async pluginRequest({
      plugin,
      method,
      payload,
    }: {
      plugin: string
      method: string
      payload: unknown
    }) {
      return runtime.plugins.rendererRequest(plugin, method, payload)
    },
    terminal: createTerminalHandlers(runtime.terminalManager),
    skills: createPiSkillsHandlers(runtime.skills),
  }
}
