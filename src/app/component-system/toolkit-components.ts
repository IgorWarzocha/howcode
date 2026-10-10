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
import { builtInPagePaths, isBuiltInView, type View } from '../types'
import { getInstalledRendererContributions } from './installed-component-catalog'
import { installedRendererContributions } from './installed-renderers.generated'
import type { ComponentKeybindingPolicy } from './keybinding-policy'

const shellGitComponent = installedRendererContributions['@howaboua/howcode-git'].component

function installedComponents() {
  return Object.values(
    getInstalledRendererContributions() as Record<string, PluginRendererContribution>,
  ).flatMap((contribution) => (contribution.component ? [contribution.component] : []))
}

function workspaceComponents() {
  return [
    workingDirectoriesComponent,
    ...installedComponents(),
    chatHistoryComponent,
    skillsComponent,
  ]
}

export function isSelectedConversationView(view: View) {
  return (
    view === 'chat' ||
    [workingDirectoriesComponent, ...installedComponents()].some((component) =>
      component.selectedConversationViews.some((route) => route === view),
    )
  )
}

export function isWorkspaceUtilityView(view: View): view is UtilityView {
  return (
    view === 'settings' ||
    workspaceComponents().some((component) =>
      component.utilityViews.some((route) => route === view),
    )
  )
}

function keybindingComponents() {
  return [...installedComponents(), terminalComponent, dictationComponent]
}

export function getComponentKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const component of keybindingComponents()) {
    const binding = component.keybindings.find((candidate) => candidate.id === commandId)
    if (binding) {
      const policy: ComponentKeybindingPolicy = { ...binding, id: commandId }
      const componentId: ToolkitComponentId | null =
        component === terminalComponent
          ? 'terminal'
          : component === dictationComponent
            ? 'dictation'
            : component === shellGitComponent
              ? 'coding'
              : null
      return { componentId, policy }
    }
  }
  return undefined
}

export function componentRendererCommandIds() {
  return keybindingComponents()
    .flatMap((component) =>
      component.keybindings
        .filter((binding) => 'renderer' in binding && binding.renderer)
        .map((binding) => binding.id),
    )
    .filter(isKeybindingCommandId)
}

// Full-page destinations share the workspace reducer and URL authority. Installed
// page IDs are package-qualified, independent of labels and transient generations.
export function getWorkspacePageViews(contributions = getInstalledRendererContributions()): View[] {
  return [
    ...Object.keys(builtInPagePaths).filter(isBuiltInView),
    ...Object.entries(contributions).flatMap(([name, contribution]) =>
      contribution.sidebarView ? [`component:${name}` as const] : [],
    ),
  ]
}

export function isWorkspaceViewEnabled(
  settings: ToolkitComponentSettings | null | undefined,
  view: View,
  contributions = getInstalledRendererContributions(),
) {
  return (
    getWorkspacePageViews(contributions).includes(view) &&
    workspaceComponents().every(
      (component) =>
        !component.views.some((route) => route === view) ||
        (component === skillsComponent
          ? isToolkitComponentEnabled(settings, 'skills')
          : component === workingDirectoriesComponent ||
              component === shellGitComponent ||
              component === chatHistoryComponent
            ? isToolkitComponentEnabled(settings, 'coding')
            : true),
    )
  )
}
