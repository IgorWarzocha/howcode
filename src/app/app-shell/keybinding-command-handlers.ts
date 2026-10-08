import type { KeybindingCommandId } from '@howcode/shared/keybindings'
import { handleChatCycleCommand } from './keybinding-chat-cycle'
import { appLevelShortcutsAreBlocked, rendererCommandIds } from './keybinding-context'
import {
  dispatchHowcodeDismissTransientUi,
  dispatchHowcodeKeybindingCommand,
} from './keybinding-events'
import type { KeybindingRuntime } from './keybinding-runtime'

export function stopActiveRun(runtime: KeybindingRuntime) {
  const activeChatData = runtime.appController.chat.activeData
  const composerDirectoryId = runtime.appController.composer.directoryId
  const { state } = runtime.appController.workspace
  if (!(activeChatData?.isStreaming && state.selectedConversationId)) return false
  if (appLevelShortcutsAreBlocked('agent.interrupt', runtime)) return false
  void runtime.appController.desktop.handleAction('composer.stop', {
    directoryId: composerDirectoryId,
    conversationId: state.selectedConversationId,
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
  const { activeView, selectedConversationId } = controller.workspace.state
  if (activeView === 'gitops') {
    controller.gitOps.close()
    return true
  }
  if (activeView !== 'chat' || !selectedConversationId) return false
  controller.gitOps.open()
  return true
}

function handleTerminalToggleCommand(runtime: KeybindingRuntime) {
  const { selectedDirectoryId, selectedConversationId } = runtime.appController.workspace.state
  if (!(selectedDirectoryId || selectedConversationId)) return false
  runtime.appController.terminal.toggle()
  return true
}

function handleTerminalFocusCommand(runtime: KeybindingRuntime) {
  const { selectedDirectoryId, selectedConversationId, terminalVisible } =
    runtime.appController.workspace.state
  if (!(selectedDirectoryId || selectedConversationId)) return false
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

function handleNewChatCommand(runtime: KeybindingRuntime) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView === 'chat') {
    if (!controller.composer.directoryId) return false
    void controller.desktop.handleAction('chat.new', {
      directoryId: controller.composer.directoryId,
      composerProfile: controller.workspace.state.composerProfile,
      workspaceId: controller.workspaces.selectedWorkspaceId,
    })
    return true
  }
  const directoryId = controller.workspace.state.selectedDirectoryId
  if (
    !(directoryId && controller.directories.items.some((directory) => directory.id === directoryId))
  )
    return false
  void controller.desktop.handleAction('chat.new', {
    directoryId,
    composerProfile: 'coding',
    workspaceId: controller.workspaces.selectedWorkspaceId,
  })
  return true
}

export function runAppCommand(commandId: KeybindingCommandId, runtime: KeybindingRuntime) {
  if (commandId === 'chat.previousInDirectory') return handleChatCycleCommand(runtime, -1)
  if (commandId === 'chat.nextInDirectory') return handleChatCycleCommand(runtime, 1)
  if (commandId === 'settings.open') return handleSettingsCommand(runtime)
  if (commandId === 'sidebar.toggle') runtime.onToggleSidebar()
  else if (commandId === 'sidebar.find') {
    runtime.onOpenSidebar()
    window.requestAnimationFrame(() => dispatchHowcodeKeybindingCommand(commandId))
  } else if (commandId === 'terminal.toggle') return handleTerminalToggleCommand(runtime)
  else if (commandId === 'terminal.focus') return handleTerminalFocusCommand(runtime)
  else if (commandId === 'gitops.open') return handleGitOpsCommand(runtime)
  else if (commandId === 'chat.new') return handleNewChatCommand(runtime)
  else if (commandId === 'agent.interrupt') return stopActiveRun(runtime)
  else if (commandId === 'composer.focus') return handleComposerFocusCommand(runtime)
  else if (handleRendererCommand(commandId)) return true
  else return false
  return true
}
