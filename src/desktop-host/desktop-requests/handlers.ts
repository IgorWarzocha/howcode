import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createPiThreadsHandlers } from './pi-threads'
import { createToolkitHostPlugins } from './toolkit-plugins'

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
  const plugins = createToolkitHostPlugins(
    input.runtime,
    input.platform.listProjectDirectoryEntries,
  )
  return {
    listComposerAttachmentEntries: input.platform.listComposerAttachmentEntries,
    searchComposerAttachmentEntries: input.platform.searchComposerAttachmentEntries,
    ...createPiThreadsHandlers(input.runtime.piThreads, input.onSettingsChanged),
    ...plugins.coding,
    ...plugins.terminal,
    ...plugins.artifacts,
    ...plugins.skills,
    ...plugins.dictation,
  }
}
