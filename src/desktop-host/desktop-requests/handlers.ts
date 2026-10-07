import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createPiSkillsHandlers } from './pi-skills'
import { createPiThreadsHandlers } from './pi-threads'
import { createTerminalHandlers } from './terminal'

export type DesktopPlatformRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listProjectDirectoryEntries'
  | 'listComposerAttachmentEntries'
  | 'searchComposerAttachmentEntries'
>

export function createDesktopRequestHandlers(input: {
  runtime: DesktopServiceRuntime
  platform: DesktopPlatformRequestHandlers
  onSettingsChanged?: (() => Promise<void> | void) | undefined
}): DesktopRequestHandlerMap {
  return {
    ...input.platform,
    ...createPiThreadsHandlers(input.runtime.piThreads, input.onSettingsChanged),
    ...createPiSkillsHandlers(input.runtime.piSkills),
    ...createTerminalHandlers(input.runtime.terminalManager),
  }
}
