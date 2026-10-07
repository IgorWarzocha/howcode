import { codingPlugin } from '@howcode/plugins/coding/ui/extension'
import { dictationPlugin } from '@howcode/plugins/dictation/ui/extension'
import { skillsPlugin } from '@howcode/plugins/skills/ui/extension'
import { terminalPlugin } from '@howcode/plugins/terminal/ui/extension'
import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import {
  isToolkitExtensionEnabled,
  type ToolkitExtensionSettings,
} from '@howcode/shared/toolkit-extensions'
import type { UtilityView } from '../state/workspace-model'
import type { View } from '../types'
import type { PluginKeybindingPolicy } from './keybinding-policy'

export const workspacePlugins = [codingPlugin, skillsPlugin]

export function isSelectedConversationView(view: View) {
  return view === 'chat' || codingPlugin.selectedConversationViews.some((route) => route === view)
}

export function isWorkspaceUtilityView(view: View): view is UtilityView {
  return (
    view === 'settings' ||
    workspacePlugins.some((plugin) => plugin.utilityViews.some((route) => route === view))
  )
}

const keybindingPlugins = [codingPlugin, terminalPlugin, dictationPlugin]

export function getPluginKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const plugin of keybindingPlugins) {
    const policy: PluginKeybindingPolicy | undefined = plugin.keybindings.find(
      (binding) => binding.id === commandId,
    )
    if (policy) return { pluginId: plugin.id, policy }
  }
  return undefined
}

export const pluginRendererCommandIds = keybindingPlugins.flatMap((plugin) =>
  plugin.keybindings
    .filter((binding) => 'renderer' in binding && binding.renderer)
    .map((binding) => binding.id),
)

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
