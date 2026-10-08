import { createPackageUiHandlers } from '../../../components/packages/host/index'
import type { DesktopRequestHandlerMap } from '../../../shared/desktop-ipc'
import type { DesktopServiceRuntime } from '../../../shared/desktop-service-contracts'
import { createAppHandlers } from './app'
import { createToolkitHostComponents } from './toolkit-components'

export type DesktopPlatformRequestHandlers = Pick<
  DesktopRequestHandlerMap,
  | 'listDirectoryDirectoryEntries'
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
    input.platform.listDirectoryDirectoryEntries,
  )
  const handlers = {
    ...createPackageUiHandlers(input.runtime.packages),
    listComposerAttachmentEntries: input.platform.listComposerAttachmentEntries,
    searchComposerAttachmentEntries: input.platform.searchComposerAttachmentEntries,
    ...createAppHandlers(input.runtime.app, input.onSettingsChanged),
    ...components.workingDirectories,
    pluginRequest: components.pluginRequest,
    ...components.terminal,
    ...components.artifacts,
    ...components.skills,
    ...components.dictation,
  }
  for (const method of Object.keys(components.plugins)) {
    if (Object.hasOwn(handlers, method))
      throw new Error(`Installed plugin request collides with host: ${method}`)
  }
  return { ...handlers, ...components.plugins }
}
