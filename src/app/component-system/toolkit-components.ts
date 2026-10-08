import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
import { chatHistoryComponent } from '@howcode/components/chat-history/ui/component'
import { dictationComponent } from '@howcode/components/dictation/ui/component'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import { terminalComponent } from '@howcode/components/terminal/ui/component'
import { workingDirectoriesComponent } from '@howcode/components/working-directories/ui/component'
import { isKeybindingCommandId, type KeybindingCommandId } from '@howcode/shared/keybindings'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentId,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import type { UtilityView } from '../state/workspace-model'
import type { View } from '../types'
import { installedRendererContributions } from './installed-renderers.generated'
import type { ComponentKeybindingPolicy } from './keybinding-policy'

const installedComponents = Object.values(
  installedRendererContributions as Record<string, PluginRendererContribution>,
).flatMap((contribution) => (contribution.component ? [contribution.component] : []))

export const workspaceComponents = [
  workingDirectoriesComponent,
  ...installedComponents,
  chatHistoryComponent,
  skillsComponent,
]

export function isSelectedConversationView(view: View) {
  return (
    view === 'chat' ||
    [workingDirectoriesComponent, ...installedComponents].some((component) =>
      component.selectedConversationViews.some((route) => route === view),
    )
  )
}

export function isWorkspaceUtilityView(view: View): view is UtilityView {
  return (
    view === 'settings' ||
    workspaceComponents.some((component) => component.utilityViews.some((route) => route === view))
  )
}

const keybindingComponents = [...installedComponents, terminalComponent, dictationComponent]

export function getComponentKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const component of keybindingComponents) {
    const binding = component.keybindings.find((candidate) => candidate.id === commandId)
    if (binding) {
      const policy: ComponentKeybindingPolicy = { ...binding, id: commandId }
      const componentId: ToolkitComponentId =
        component.id === 'terminal'
          ? 'terminal'
          : component.id === 'dictation'
            ? 'dictation'
            : 'coding'
      return { componentId, policy }
    }
  }
  return undefined
}

export const componentRendererCommandIds = keybindingComponents
  .flatMap((component) =>
    component.keybindings
      .filter((binding) => 'renderer' in binding && binding.renderer)
      .map((binding) => binding.id),
  )
  .filter(isKeybindingCommandId)

export function isWorkspaceViewEnabled(
  settings: ToolkitComponentSettings | null | undefined,
  view: View,
) {
  return workspaceComponents.every(
    (component) =>
      !component.views.some((route) => route === view) ||
      isToolkitComponentEnabled(settings, component.id === 'skills' ? 'skills' : 'coding'),
  )
}
