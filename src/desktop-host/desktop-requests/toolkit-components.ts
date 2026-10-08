import { createArtifactsHandlers } from '../../../components/artifacts/host/index'
import { createDictationHandlers } from '../../../components/dictation/host/index'
import { createGitHandlers } from '../../../components/git/host/index'
import { createPiSkillsHandlers } from '../../../components/skills/host/index'
import { createTerminalHandlers } from '../../../components/terminal/host/index'
import { createWorkingDirectoriesHandlers } from '../../../components/working-directories/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'

// Built-in host contributions remain available independently of UI presentation
// and Durable's persisted agent tool selection.
export function createToolkitHostComponents(
  runtime: DesktopServiceRuntime,
  listDirectoryDirectoryEntries: DesktopRequestHandlerMap['listDirectoryDirectoryEntries'],
) {
  return {
    workingDirectories: createWorkingDirectoriesHandlers(
      runtime.workingDirectories,
      listDirectoryDirectoryEntries,
    ),
    git: createGitHandlers(runtime.git),
    terminal: createTerminalHandlers(runtime.terminalManager),
    artifacts: createArtifactsHandlers(runtime.artifacts),
    skills: createPiSkillsHandlers(runtime.skills),
    dictation: createDictationHandlers(runtime.dictation),
  }
}
