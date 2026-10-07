import { codingComponent } from '@howcode/components/coding/ui/component'
import { dictationComponent } from '@howcode/components/dictation/ui/component'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import { terminalComponent } from '@howcode/components/terminal/ui/component'
import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import type { UtilityView } from '../state/workspace-model'
import type { View } from '../types'
import type { ComponentKeybindingPolicy } from './keybinding-policy'

export const workspaceComponents = [codingComponent, skillsComponent]

export function isSelectedConversationView(view: View) {
  return (
    view === 'chat' || codingComponent.selectedConversationViews.some((route) => route === view)
  )
}

export function isWorkspaceUtilityView(view: View): view is UtilityView {
  return (
    view === 'settings' ||
    workspaceComponents.some((component) => component.utilityViews.some((route) => route === view))
  )
}

const keybindingComponents = [codingComponent, terminalComponent, dictationComponent]

export function getComponentKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const component of keybindingComponents) {
    const policy: ComponentKeybindingPolicy | undefined = component.keybindings.find(
      (binding) => binding.id === commandId,
    )
    if (policy) return { componentId: component.id, policy }
  }
  return undefined
}

export const componentRendererCommandIds = keybindingComponents.flatMap((component) =>
  component.keybindings
    .filter((binding) => 'renderer' in binding && binding.renderer)
    .map((binding) => binding.id),
)

export function isWorkspaceViewEnabled(
  settings: ToolkitComponentSettings | null | undefined,
  view: View,
) {
  return workspaceComponents.every(
    (component) =>
      !component.views.some((route) => route === view) ||
      isToolkitComponentEnabled(settings, component.id),
  )
}
