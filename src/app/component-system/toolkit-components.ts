import type { PluginRendererContribution } from '@howaboua/howcode-sdk/plugins'
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
import { installedPageView } from './installed-renderer-context'
import type { ComponentKeybindingPolicy } from './keybinding-policy'
import { classicNavigationRenderer } from './navigation-selection'

function installedComponents() {
  return Object.values(
    getInstalledRendererContributions() as Record<string, PluginRendererContribution>,
  ).flatMap((contribution) => (contribution.component ? [contribution.component] : []))
}

function workspaceComponents() {
  return [workingDirectoriesComponent, ...installedComponents()]
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
    view === 'history' ||
    workspaceComponents().some((component) =>
      component.utilityViews.some((route) => route === view),
    )
  )
}

function keybindingComponents() {
  return installedComponents()
}

export function getComponentKeybindingPolicy(commandId: KeybindingCommandId) {
  for (const component of keybindingComponents()) {
    const binding = component.keybindings.find((candidate) => candidate.id === commandId)
    if (binding) {
      const policy: ComponentKeybindingPolicy = { ...binding, id: commandId }
      const componentId: ToolkitComponentId | null = component.id === 'terminal' ? 'terminal' : null
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
      contribution.sidebarView ? [installedPageView(name)] : [],
    ),
  ]
}

export function isWorkspaceViewEnabled(
  settings: (ToolkitComponentSettings & { navigationRenderer?: string }) | null | undefined,
  view: View,
  contributions = getInstalledRendererContributions(),
) {
  return (
    getWorkspacePageViews(contributions).includes(view) &&
    (view !== 'history' ||
      Boolean(
        contributions[settings?.navigationRenderer ?? classicNavigationRenderer]?.navigation
          ?.History,
      )) &&
    workspaceComponents().every(
      (component) =>
        !component.views.some((route) => route === view) ||
        (component.id === 'skills' ? isToolkitComponentEnabled(settings, 'skills') : true),
    )
  )
}
