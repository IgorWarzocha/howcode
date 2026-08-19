import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import { appLevelShortcutsAreBlocked, rendererCommandIds } from './keybinding-context'
import {
  dispatchHowcodeDismissTransientUi,
  dispatchHowcodeKeybindingCommand,
} from './keybinding-events'
import type { KeybindingRuntime } from './keybinding-runtime'
import { handleThreadCycleCommand } from './keybinding-thread-cycle'

export function stopActiveRun(runtime: KeybindingRuntime) {
  const activeThreadData = runtime.appController.thread.activeData
  const composerProjectId = runtime.appController.composer.projectId
  const { state } = runtime.appController.workspace
  if (!(activeThreadData?.isStreaming && state.selectedSessionPath)) return false
  if (appLevelShortcutsAreBlocked('agent.interrupt', runtime)) return false
  void runtime.appController.desktop.handleAction('composer.stop', {
    projectId: composerProjectId,
    sessionPath: state.selectedSessionPath,
  })
  return true
}

function handleRendererCommand(commandId: KeybindingCommandId) {
  if (!rendererCommandIds.has(commandId)) return false
  return dispatchHowcodeKeybindingCommand(commandId)
}

function handleSettingsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView === 'settings') controller.navigation.closeUtilityView()
  else controller.navigation.showView('settings')
  return true
}

function handleGitOpsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  const { activeView, selectedSessionPath } = controller.workspace.state
  if (activeView === 'gitops') {
    controller.gitOps.close()
    return true
  }
  if (activeView !== 'thread' || !selectedSessionPath) return false
  controller.gitOps.open()
  return true
}

function handleTerminalToggleCommand(runtime: KeybindingRuntime) {
  const { selectedProjectId, selectedSessionPath } = runtime.appController.workspace.state
  if (!(selectedProjectId || selectedSessionPath)) return false
  runtime.appController.terminal.toggle()
  return true
}

function handleTerminalFocusCommand(runtime: KeybindingRuntime) {
  const { selectedProjectId, selectedSessionPath, terminalVisible } =
    runtime.appController.workspace.state
  if (!(selectedProjectId || selectedSessionPath)) return false
  dispatchHowcodeDismissTransientUi()
  runtime.onFocusTerminal()
  if (!terminalVisible) runtime.appController.terminal.toggle()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => dispatchHowcodeKeybindingCommand('terminal.focus'))
  })
  return true
}

function handleComposerFocusCommand(runtime: KeybindingRuntime) {
  dispatchHowcodeDismissTransientUi()
  runtime.onFocusComposer()
  window.requestAnimationFrame(() => dispatchHowcodeKeybindingCommand('composer.focus'))
  return true
}

function handleNewThreadCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView === 'chat') {
    if (!controller.composer.projectId) return false
    void controller.desktop.handleAction('thread.new', {
      projectId: controller.composer.projectId,
      composerMode: 'chat',
      chatGroupId: controller.chat.selectedGroupId,
    })
    return true
  }
  const projectId = controller.workspace.state.selectedProjectId
  if (!(projectId && controller.projects.items.some((project) => project.id === projectId)))
    return false
  void controller.desktop.handleAction('thread.new', {
    projectId,
    composerMode: 'code',
    chatGroupId: controller.chat.selectedGroupId,
  })
  return true
}

export function runAppCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  if (commandId === 'thread.previousInProject') return handleThreadCycleCommand(runtime, -1)
  if (commandId === 'thread.nextInProject') return handleThreadCycleCommand(runtime, 1)
  if (commandId === 'settings.open') return handleSettingsCommand(runtime)
  if (commandId === 'sidebar.toggle') runtime.onToggleSidebar()
  else if (commandId === 'sidebar.find') {
    runtime.onOpenSidebar()
    window.requestAnimationFrame(() => dispatchHowcodeKeybindingCommand(commandId))
  } else if (commandId === 'terminal.toggle') return handleTerminalToggleCommand(runtime)
  else if (commandId === 'terminal.focus') return handleTerminalFocusCommand(runtime)
  else if (commandId === 'gitops.open') return handleGitOpsCommand(runtime)
  else if (commandId === 'thread.new') return handleNewThreadCommand(runtime)
  else if (commandId === 'agent.interrupt') return stopActiveRun(runtime)
  else if (commandId === 'composer.focus') return handleComposerFocusCommand(runtime)
  else if (handleRendererCommand(commandId)) return true
  else return false
  return true
}
