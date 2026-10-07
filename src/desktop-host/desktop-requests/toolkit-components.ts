import { createArtifactsHandlers } from '../../../components/artifacts/host/index'
import { createCodingHandlers } from '../../../components/coding/host/index'
import { createDictationHandlers } from '../../../components/dictation/host/index'
import { createPiSkillsHandlers } from '../../../components/skills/host/index'
import { createTerminalHandlers } from '../../../components/terminal/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import type { ToolkitComponentId } from '../../../shared/toolkit-components'

// Trusted host contributions remain available independently of UI presentation
// and Durable's persisted agent tool selection. There is no third-party loader.
export function createToolkitHostComponents(
  runtime: DesktopServiceRuntime,
  listProjectDirectoryEntries: DesktopRequestHandlerMap['listProjectDirectoryEntries'],
) {
  return {
    coding: createCodingHandlers(runtime.coding, listProjectDirectoryEntries),
    terminal: createTerminalHandlers(runtime.terminalManager),
    artifacts: createArtifactsHandlers(runtime.artifacts),
    skills: createPiSkillsHandlers(runtime.skills),
    dictation: createDictationHandlers(runtime.dictation),
  } satisfies Record<ToolkitComponentId, object>
}
