import type {
  Workspace,
  WorkspaceChat,
  WorkspaceNavigationState,
} from '@howcode/shared/desktop-workspace-contracts'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace-model'
import type { View, WorkingDirectory } from '../types'

export type AppRouteSnapshot = { pathname: string; search: Record<string, unknown> }

const utilityRoutes = new Set<View>([
  'archived',
  'automations',
  'claw',
  'inbox',
  'settings',
  'history',
  'skills',
  'work',
])
const leadingSlashes = /^\/+/

function searchValue(search: AppRouteSnapshot['search'], key: string) {
  const value = search[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function normalizeAppRoute(snapshot: AppRouteSnapshot) {
  const path = snapshot.pathname.replace(leadingSlashes, '') || 'landing'
  const routeName = path === 'workspaces' ? 'workspace' : path === 'chats' ? 'chat' : path
  return {
    routeName,
    workspaceId: searchValue(snapshot.search, 'workspaceId'),
    chatId: searchValue(snapshot.search, 'chatId'),
    conversationId: searchValue(snapshot.search, 'conversationId'),
  }
}

export function findWorkspaceForDirectory(
  navigation: WorkspaceNavigationState | null,
  directories: WorkingDirectory[],
  directoryId: string,
) {
  const directory = directories.find(
    (item) => item.id === directoryId || item.resolvedId === directoryId,
  )
  const rootId = directory?.worktree?.rootDirectoryId ?? directory?.id ?? directoryId
  return navigation?.workspaces.find((workspace) => workspace.directoryId === rootId) ?? null
}

function findWorkspaceChat(
  navigation: WorkspaceNavigationState | null,
  chatId: string | null,
  conversationId: string | null,
) {
  if (!(navigation && (chatId || conversationId))) return null
  const matches = (candidate: WorkspaceChat) =>
    candidate.id === chatId ||
    (conversationId !== null && candidate.conversationId === conversationId)
  for (const workspace of navigation.workspaces) {
    const chat = workspace.chats.find(matches)
    if (chat) return { chat, workspace }
  }
  const chat = navigation.unassignedChats.find(matches)
  return chat ? { chat, workspace: null } : null
}

function workspaceAction(workspace: Workspace | null): WorkspaceAction {
  return {
    type: 'select-workspace',
    workspaceId: workspace?.id ?? null,
    directoryId: workspace?.directoryId ?? null,
  }
}

export function getRouteAction(
  snapshot: AppRouteSnapshot,
  navigation: WorkspaceNavigationState | null,
): WorkspaceAction | WorkspaceAction[] | null {
  const route = normalizeAppRoute(snapshot)
  const workspace = navigation?.workspaces.find((item) => item.id === route.workspaceId) ?? null
  if (route.routeName === 'landing') return { type: 'show-landing' }
  if (
    route.routeName === 'workspace' ||
    (route.routeName === 'chat' && !route.chatId && !route.conversationId)
  ) {
    return workspaceAction(workspace)
  }
  if (route.routeName === 'chat' || route.routeName === 'git') {
    const action = getConversationRouteAction(route, navigation)
    if (route.routeName !== 'git') return action
    // A Git URL opens the panel over its real chat/workspace, never a replacement view.
    return [action ?? workspaceAction(workspace), { type: 'open-gitops' }]
  }
  if (route.routeName === 'inbox') {
    return [
      { type: 'show-view', view: 'inbox' },
      { type: 'select-inbox-chat', conversationId: route.conversationId },
    ]
  }
  return utilityRoutes.has(route.routeName as View)
    ? { type: 'show-view', view: route.routeName as View }
    : null
}

function getConversationRouteAction(
  route: ReturnType<typeof normalizeAppRoute>,
  navigation: WorkspaceNavigationState | null,
): WorkspaceAction | null {
  const target = findWorkspaceChat(navigation, route.chatId, route.conversationId)
  if (target?.chat.conversationId) {
    const open: WorkspaceAction = {
      type: 'open-chat',
      workspaceId: target.workspace?.id ?? null,
      directoryId: target.chat.directoryId,
      chatId: target.chat.id,
      conversationId: target.chat.conversationId,
      composerProfile: target.chat.composerProfile,
    }
    return open
  }
  return null
}

export function getRouteForState(
  state: Pick<
    WorkspaceState,
    | 'activeView'
    | 'selectedChatId'
    | 'selectedConversationId'
    | 'selectedDirectoryId'
    | 'selectedWorkspaceId'
    | 'selectedInboxConversationId'
  >,
  navigation: WorkspaceNavigationState | null,
  directories: WorkingDirectory[],
): AppRouteSnapshot {
  const target = findWorkspaceChat(navigation, state.selectedChatId, state.selectedConversationId)
  const directoryWorkspace = state.selectedDirectoryId
    ? findWorkspaceForDirectory(navigation, directories, state.selectedDirectoryId)
    : null
  const workspaceId = target?.workspace?.id ?? directoryWorkspace?.id ?? state.selectedWorkspaceId
  const search = {
    ...(workspaceId ? { workspaceId } : {}),
    ...(state.selectedChatId ? { chatId: state.selectedChatId } : {}),
  }
  if (state.activeView === 'landing') return { pathname: '/', search: {} }
  if (state.activeView === 'chat' && state.selectedChatId) return { pathname: '/chats', search }
  if (
    state.activeView === 'workspace' ||
    state.activeView === 'directory' ||
    state.activeView === 'directories' ||
    state.activeView === 'chat'
  ) {
    return { pathname: '/workspaces', search: workspaceId ? { workspaceId } : {} }
  }
  if (state.activeView === 'inbox')
    return {
      pathname: '/inbox',
      search: state.selectedInboxConversationId
        ? { conversationId: state.selectedInboxConversationId }
        : {},
    }
  return { pathname: `/${state.activeView}`, search: {} }
}
