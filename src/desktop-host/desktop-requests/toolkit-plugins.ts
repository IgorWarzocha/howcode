import { createArtifactsHandlers } from '../../../plugins/artifacts/host/index'
import { createCodingHandlers } from '../../../plugins/coding/host/index'
import { createDictationHandlers } from '../../../plugins/dictation/host/index'
import { createPiSkillsHandlers } from '../../../plugins/skills/host/index'
import { createTerminalHandlers } from '../../../plugins/terminal/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import type { ToolkitExtensionId } from '../../../shared/toolkit-extensions'

// Trusted host contributions remain available independently of UI presentation
// and Durable's persisted agent tool selection. There is no third-party loader.
export function createToolkitHostPlugins(
  runtime: DesktopServiceRuntime,
  listProjectDirectoryEntries: DesktopRequestHandlerMap['listProjectDirectoryEntries'],
) {
  return {
    coding: createCodingHandlers(runtime.coding, listProjectDirectoryEntries),
    terminal: createTerminalHandlers(runtime.terminalManager),
    artifacts: createArtifactsHandlers(runtime.artifacts),
    skills: createPiSkillsHandlers(runtime.skills),
    dictation: createDictationHandlers(runtime.dictation),
  } satisfies Record<ToolkitExtensionId, object>
}
