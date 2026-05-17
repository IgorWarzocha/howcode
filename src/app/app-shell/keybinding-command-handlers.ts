import type { KeybindingCommandId } from '../../../shared/keybindings'
import { appLevelShortcutsAreBlocked, rendererCommandIds } from './keybinding-context'
import { dispatchHowcodeKeybindingCommand } from './keybinding-events'
import type { KeybindingRuntime } from './keybinding-runtime'
import { handleThreadCycleCommand } from './keybinding-thread-cycle'

export function stopActiveRun(runtime: KeybindingRuntime) {
  const { activeThreadData, composerProjectId, state } = runtime.appController
  if (!(activeThreadData?.isStreaming && state.selectedSessionPath)) return false
  if (appLevelShortcutsAreBlocked('agent.interrupt', runtime)) return false
  void runtime.appController.handleAction('composer.stop', {
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
  if (controller.state.activeView === 'settings') controller.handleCloseUtilityView()
  else controller.handleShowView('settings')
  return true
}

function handleGitOpsCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  const { activeView, selectedSessionPath } = controller.state
  if (activeView === 'gitops') {
    controller.handleCloseGitOpsView()
    return true
  }
  if (activeView !== 'thread' || !selectedSessionPath) return false
  controller.handleOpenGitOpsView()
  return true
}

function handleTerminalToggleCommand(runtime: KeybindingRuntime) {
  const { selectedProjectId, selectedSessionPath } = runtime.appController.state
  if (!(selectedProjectId || selectedSessionPath)) return false
  runtime.appController.handleToggleTerminal()
  return true
}

function handleNewThreadCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.state.activeView === 'chat') {
    if (!controller.composerProjectId) return false
    void controller.handleAction('thread.new', {
      projectId: controller.composerProjectId,
      composerMode: 'chat',
      chatGroupId: controller.selectedChatGroupId,
    })
    return true
  }
  const projectId = controller.state.selectedProjectId
  if (!(projectId && controller.projects.some((project) => project.id === projectId))) return false
  void controller.handleAction('thread.new', {
    projectId,
    composerMode: 'code',
    chatGroupId: controller.selectedChatGroupId,
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
  else if (commandId === 'gitops.open') return handleGitOpsCommand(runtime)
  else if (commandId === 'thread.new') return handleNewThreadCommand(runtime)
  else if (commandId === 'agent.interrupt') return stopActiveRun(runtime)
  else if (handleRendererCommand(commandId)) return true
  else return false
  return true
}
