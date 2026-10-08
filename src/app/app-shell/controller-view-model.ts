import type { ChatData } from '../desktop/types'
import { getCurrentTitle, getDirectoryName, selectChat, selectDirectory } from '../state/workspace'
import type { WorkspaceState } from '../state/workspace-model'
import type { Chat, WorkingDirectory } from '../types'

const pathSeparatorPattern = /[\\/]/

type DeriveControllerViewModelInput = {
  directories: WorkingDirectory[]
  workspaceState: WorkspaceState
  chatData: ChatData | null
  shellCwd: string | null | undefined
  composerState: import('../desktop/types').ComposerState | null
  shellComposerState: import('../desktop/types').ComposerState | null | undefined
}

type ControllerViewModel = {
  collapsedDirectoryIds: Record<string, boolean>
  selectedDirectory: WorkingDirectory | undefined
  selectedChat: Chat | undefined
  activeChatData: ChatData | null
  currentTitle: string
  currentDirectoryName: string
  composerDirectoryId: string
  activeComposerState: import('../desktop/types').ComposerState | null
}

function buildFallbackChatData(conversationId: string, selectedChat: Chat | undefined): ChatData {
  return {
    conversationId,
    title: selectedChat?.title ?? 'New chat',
    messages: [],
    previousMessageCount: 0,
    isStreaming: false,
    isCompacting: false,
  }
}

function getSelectedDirectoryName(
  directory: WorkingDirectory | undefined,
  selectedDirectoryId: string,
) {
  if (directory) return getDirectoryName(directory)
  const pathParts = selectedDirectoryId.split(pathSeparatorPattern).filter(Boolean)
  return pathParts.at(-1) ?? getDirectoryName(undefined)
}

function getComposerDirectoryId(input: {
  selectedDirectory: WorkingDirectory | undefined
  selectedDirectoryId: string
  hasSelectedDirectory: boolean
  shellCwd: string | null | undefined
}) {
  if (input.selectedDirectory) return input.selectedDirectory.id
  if (input.hasSelectedDirectory && input.selectedDirectoryId) return input.selectedDirectoryId
  return input.shellCwd ?? ''
}

export function deriveControllerViewModel({
  directories,
  workspaceState,
  chatData,
  shellCwd,
  composerState,
  shellComposerState,
}: DeriveControllerViewModelInput): ControllerViewModel {
  const collapsedDirectoryIds = Object.fromEntries(
    directories.map((directory) => [
      directory.id,
      workspaceState.collapsedDirectoryIds[directory.id] ?? directory.collapsed ?? true,
    ]),
  )
  const selectedDirectory = selectDirectory(directories, workspaceState.selectedDirectoryId)
  const selectedChat = selectChat(selectedDirectory, workspaceState.selectedChatId)
  const activeChatData = workspaceState.selectedConversationId
    ? (chatData ?? buildFallbackChatData(workspaceState.selectedConversationId, selectedChat))
    : null

  return {
    collapsedDirectoryIds,
    selectedDirectory,
    selectedChat,
    activeChatData,
    currentTitle:
      workspaceState.activeView === 'chat'
        ? (activeChatData?.title ?? selectedChat?.title ?? 'New chat')
        : getCurrentTitle(workspaceState.activeView, selectedChat),
    currentDirectoryName: getSelectedDirectoryName(
      selectedDirectory,
      workspaceState.selectedDirectoryId,
    ),
    // Keep sidebar selection strict, but never let composer/runtime actions fall back
    // to the app shell cwd while the user has a selected directory. The directory list can
    // be briefly stale around directory creation/new-chat transitions; the workspace
    // selection is still the intended runtime cwd.
    composerDirectoryId: getComposerDirectoryId({
      selectedDirectory,
      selectedDirectoryId: workspaceState.selectedDirectoryId,
      hasSelectedDirectory: workspaceState.hasSelectedDirectory,
      shellCwd,
    }),
    activeComposerState: composerState ?? shellComposerState ?? null,
  }
}
