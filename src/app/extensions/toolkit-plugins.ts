import { codingPlugin } from '@howcode/plugins/coding/ui/extension'
import { skillsPlugin } from '@howcode/plugins/skills/ui/extension'
import {
  isToolkitExtensionEnabled,
  type ToolkitExtensionSettings,
} from '@howcode/shared/toolkit-extensions'
import type { View } from '../types'

export const workspacePlugins = [codingPlugin, skillsPlugin]

export function isWorkspaceViewEnabled(
  settings: ToolkitExtensionSettings | null | undefined,
  view: View,
) {
  return workspacePlugins.every(
    (plugin) =>
      !plugin.views.some((route) => route === view) ||
      isToolkitExtensionEnabled(settings, plugin.id),
  )
}
