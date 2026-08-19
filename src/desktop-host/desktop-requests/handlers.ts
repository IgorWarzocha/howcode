import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createPiPackagesHandlers } from './pi-packages'
import { createPiSkillsHandlers } from './pi-skills'
import { createPiThreadsHandlers } from './pi-threads'
import { createTerminalHandlers } from './terminal'

export type DesktopPlatformRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'getAppUpdateState'
  | 'checkAppUpdate'
  | 'installAppUpdate'
  | 'restartAppUpdate'
  | 'clearClipboardImages'
  | 'pickComposerAttachments'
  | 'listProjectDirectoryEntries'
  | 'readClipboardSnapshot'
  | 'readClipboardFilePaths'
  | 'readClipboardImage'
  | 'getAttachmentKindsForPaths'
  | 'listComposerAttachmentEntries'
  | 'searchComposerAttachmentEntries'
  | 'openExternal'
  | 'openPath'
  | 'saveTextToDownloads'
>

export function createDesktopRequestHandlers(input: {
  runtime: DesktopServiceRuntime
  platform: DesktopPlatformRequestHandlers
  onSettingsChanged?: (() => Promise<void> | void) | undefined
}): DesktopRequestHandlerMap {
  return {
    ...input.platform,
    ...createPiThreadsHandlers(input.runtime.piThreads, input.onSettingsChanged),
    ...createPiPackagesHandlers(input.runtime.piThreads),
    ...createPiSkillsHandlers(input.runtime.piSkills),
    ...createTerminalHandlers(input.runtime.terminalManager),
  }
}
