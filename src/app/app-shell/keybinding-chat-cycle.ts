import type { Chat, WorkingDirectory } from '../types'
import type { KeybindingRuntime } from './keybinding-runtime'

function findSelectedChatIndex(
  directory: WorkingDirectory | null,
  selectedConversationId: string | null,
  selectedChatId: string | null,
) {
  if (!directory) return -1
  const selectedChatIndex = directory.chats.findIndex(
    (chat) => selectedChatId !== null && chat.id === selectedChatId,
  )
  if (selectedChatIndex >= 0) return selectedChatIndex
  return directory.chats.findIndex((chat) => {
    return Boolean(selectedConversationId && chat.conversationId === selectedConversationId)
  })
}

function getChatConversationId(chat: Chat) {
  return chat.conversationId ?? chat.id
}

function getAdjacentIndex(currentIndex: number, length: number, direction: -1 | 1) {
  if (length === 0) return -1
  if (currentIndex < 0) return direction > 0 ? 0 : length - 1
  return (currentIndex + direction + length) % length
}

function openAdjacentChat(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (
    !(
      controller.workspace.state.activeView === 'chat' ||
      controller.workspace.state.activeView === 'directory'
    )
  ) {
    return false
  }
  if (
    controller.workspace.state.activeView === 'directory' &&
    !controller.workspace.state.selectedDirectoryId
  )
    return false
  const directory =
    controller.directories.items.find(
      (item) =>
        item.id ===
        (controller.workspace.state.selectedDirectoryId || controller.composer.directoryId),
    ) ?? null
  const cycleSelection = runtime.cycleSelectionRef.current
  const hasChatCycleSelection =
    cycleSelection !== null &&
    cycleSelection.directoryId === directory?.id &&
    cycleSelection.view === 'chat'
  const index = findSelectedChatIndex(
    directory,
    hasChatCycleSelection
      ? cycleSelection.conversationId
      : controller.workspace.state.selectedConversationId,
    hasChatCycleSelection ? cycleSelection.chatId : controller.workspace.state.selectedChatId,
  )
  if (!(directory && directory.chats.length > 0)) return false
  const nextIndex = getAdjacentIndex(index, directory.chats.length, direction)
  const nextChat = directory.chats[nextIndex]
  if (!nextChat) return false
  runtime.cycleSelectionRef.current = {
    directoryId: directory.id,
    chatId: nextChat.id,
    conversationId: getChatConversationId(nextChat),
    view: 'chat',
  }
  controller.chat.cycle(directory.id, nextChat.id, getChatConversationId(nextChat), 'coding')
  return true
}

function getWorkspaceChats(runtime: KeybindingRuntime) {
  const chatState = runtime.appController.workspaces.state
  if (!chatState) return []
  const workspaceId = runtime.appController.workspace.state.selectedWorkspaceId
  const workspace = chatState.workspaces.find((item) => item.id === workspaceId)
  return workspace
    ? workspace.chats
    : [...chatState.unassignedChats, ...chatState.workspaces.flatMap((item) => item.chats)]
}

function openAdjacentWorkspaceChat(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView !== 'chat') return null
  const chats = getWorkspaceChats(runtime)
  const cycleSelection = runtime.cycleSelectionRef.current
  const hasChatCycleSelection = cycleSelection !== null && cycleSelection.view === 'chat'
  const index = findSelectedChatIndex(
    { id: 'chat', name: 'Chat', chats },
    hasChatCycleSelection
      ? cycleSelection.conversationId
      : controller.workspace.state.selectedConversationId,
    hasChatCycleSelection ? cycleSelection.chatId : controller.workspace.state.selectedChatId,
  )
  const nextChat = chats[getAdjacentIndex(index, chats.length, direction)]
  if (!nextChat?.conversationId) return false
  runtime.cycleSelectionRef.current = {
    directoryId: nextChat.directoryId,
    chatId: nextChat.id,
    conversationId: nextChat.conversationId,
    view: 'chat',
  }
  controller.chat.cycle(
    nextChat.directoryId,
    nextChat.id,
    nextChat.conversationId,
    nextChat.composerProfile,
  )
  return true
}

function selectAdjacentInboxChat(runtime: KeybindingRuntime, direction: -1 | 1) {
  const controller = runtime.appController
  if (controller.workspace.state.activeView !== 'inbox') return null
  const selectedPath = controller.workspace.state.selectedInboxConversationId
  const currentIndex = selectedPath
    ? controller.inbox.chats.findIndex((chat) => chat.conversationId === selectedPath)
    : 0
  if (controller.inbox.chats.length === 0) return false
  const nextIndex = getAdjacentIndex(currentIndex, controller.inbox.chats.length, direction)
  const nextChat = controller.inbox.chats[nextIndex]
  if (!nextChat) return false
  controller.inbox.select(nextChat)
  return true
}

export function handleChatCycleCommand(runtime: KeybindingRuntime, direction: -1 | 1) {
  return (
    selectAdjacentInboxChat(runtime, direction) ??
    openAdjacentWorkspaceChat(runtime, direction) ??
    openAdjacentChat(runtime, direction)
  )
}
