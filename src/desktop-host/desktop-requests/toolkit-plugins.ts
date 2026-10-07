import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import type { ToolkitExtensionId } from '../../../shared/toolkit-extensions'
import { createArtifactsHandlers } from './artifacts'
import { createCodingHandlers } from './coding'
import { createDictationHandlers } from './dictation'
import { createPiSkillsHandlers } from './pi-skills'
import { createTerminalHandlers } from './terminal'

// Trusted host contributions remain available independently of UI presentation
// and Durable's persisted agent tool selection. There is no third-party loader.
export function createToolkitHostPlugins(
  runtime: DesktopServiceRuntime,
  listProjectDirectoryEntries: DesktopRequestHandlerMap['listProjectDirectoryEntries'],
) {
  return {
    coding: createCodingHandlers(runtime.piThreads, listProjectDirectoryEntries),
    terminal: createTerminalHandlers(runtime.terminalManager),
    artifacts: createArtifactsHandlers(runtime.piThreads),
    skills: createPiSkillsHandlers(runtime.piSkills, runtime.piThreads),
    dictation: createDictationHandlers(runtime.piThreads),
  } satisfies Record<ToolkitExtensionId, object>
}
