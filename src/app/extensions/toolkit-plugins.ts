import {
  isToolkitExtensionEnabled,
  type ToolkitExtensionSettings,
} from '@howcode/shared/toolkit-extensions'
import type { View } from '../types'
import { codingPlugin } from './coding-plugin'
import { skillsPlugin } from './skills-plugin'

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
