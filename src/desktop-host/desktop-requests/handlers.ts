import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createAppHandlers } from './app'
import { createToolkitHostComponents } from './toolkit-components'

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
  const components = createToolkitHostComponents(
    input.runtime,
    input.platform.listProjectDirectoryEntries,
  )
  return {
    listComposerAttachmentEntries: input.platform.listComposerAttachmentEntries,
    searchComposerAttachmentEntries: input.platform.searchComposerAttachmentEntries,
    ...createAppHandlers(input.runtime.app, input.onSettingsChanged),
    ...components.coding,
    ...components.terminal,
    ...components.artifacts,
    ...components.skills,
    ...components.dictation,
  }
}
