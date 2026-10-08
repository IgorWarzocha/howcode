import { chatHistoryComponent } from '@howcode/components/chat-history/ui/component'
import { dictationComponent } from '@howcode/components/dictation/ui/component'
import { gitComponent } from '@howcode/components/git/ui/component'
import { skillsComponent } from '@howcode/components/skills/ui/component'
import { terminalComponent } from '@howcode/components/terminal/ui/component'
import { workingDirectoriesComponent } from '@howcode/components/working-directories/ui/component'
import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import {
  isToolkitComponentEnabled,
  type ToolkitComponentSettings,
} from '@howcode/shared/toolkit-components'
import type { UtilityView } from '../state/workspace-model'
import type { View } from '../types'
import type { ComponentKeybindingPolicy } from './keybinding-policy'

export const workspaceComponents = [
  workingDirectoriesComponent,
  gitComponent,
  chatHistoryComponent,
  skillsComponent,
]

export function isSelectedConversationView(view: View) {
  return (
    view === 'chat' ||
    [workingDirectoriesComponent, gitComponent].some((component) =>
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

const keybindingComponents = [gitComponent, terminalComponent, dictationComponent]

export function getComponentKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const component of keybindingComponents) {
    const policy: ComponentKeybindingPolicy | undefined = component.keybindings.find(
      (binding) => binding.id === commandId,
    )
    if (policy)
      return { componentId: component.id === 'git' ? ('coding' as const) : component.id, policy }
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
      isToolkitComponentEnabled(settings, component.id === 'skills' ? 'skills' : 'coding'),
  )
}
