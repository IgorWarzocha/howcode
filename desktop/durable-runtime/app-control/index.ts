import { withAbortSignal } from '@earendil-works/chord/context'
import type { AppControlCaller, AppControlResult } from '../../../shared/app-control.ts'
import { getDesktopWorkingDirectory } from '../../../shared/desktop-working-directory.ts'
import { DEFAULT_WORKSPACE_ID } from '../../../shared/desktop-workspace-contracts.ts'
import { ensureConversationProjection } from '../../app-service/conversation-projection.ts'
import { refreshShellIndex } from '../../app-service/shell-index.ts'
import { renameChatTitle } from '../../chat-repository.ts'
import { startNewChat } from '../../conversation-runtime.ts'
import { resolveInstalledWorkspaceAgent } from '../../plugins/runtime.ts'
import { createWorkspace, getWorkspaceNavigationState } from '../../workspace-repository.ts'
import { resolveConversation, runtimeContext } from '../host.ts'
import { executeChatAction } from './chat-actions.ts'
import { appControlHelp, decodeAppControlInput } from './input.ts'

function page<T>(items: T[], cursor = '0', limit = 20) {
  const offset = Number(cursor)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length)
    throw new Error('Invalid cursor. Restart this list without cursor.')
  return {
    items: items.slice(offset, offset + limit),
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
  }
}

function exact<T extends { id: string }>(
  items: T[],
  value: string,
  name: (item: T) => string,
  label: string,
) {
  const byId = items.find((item) => item.id === value)
  if (byId) return byId
  const matches = items.filter((item) => name(item) === value)
  const match = matches[0]
  if (matches.length !== 1 || !match)
    throw new Error(
      `${label} ${matches.length > 0 ? 'name is ambiguous' : 'not found'}: ${value}. List ${label.toLowerCase()}s and use an ID.`,
    )
  return match
}

async function workspaceSummary(
  workspace: ReturnType<typeof getWorkspaceNavigationState>['workspaces'][number],
) {
  const agent = await resolveInstalledWorkspaceAgent(workspace.id)
  return {
    id: workspace.id,
    name: workspace.name.slice(0, 1000),
    nameTruncated: workspace.name.length > 1000,
    directoryId: workspace.directoryId ?? null,
    workspaceAgent: agent ? { ...agent } : null,
  }
}

/** One policy/dispatcher shared by native tools and external transports. Never replay calls here. */
export async function executeAppControl(
  input: unknown,
  caller: AppControlCaller = {},
): Promise<AppControlResult> {
  const args = await decodeAppControlInput(input)
  caller.signal?.throwIfAborted()
  const context = caller.signal ? withAbortSignal(caller.signal, runtimeContext) : runtimeContext
  if (args.action === 'help') return appControlHelp
  await ensureConversationProjection()
  caller.signal?.throwIfAborted()
  if (args.action === 'workspaces.create') {
    const state = createWorkspace(args.name)
    const created = state.workspaces.find(({ id }) => id === state.selectedWorkspaceId)
    if (!created)
      throw new Error('Workspace created but unavailable; list workspaces before retrying.')
    await refreshShellIndex(getDesktopWorkingDirectory())
    return workspaceSummary(created)
  }
  const navigation = getWorkspaceNavigationState()
  if (args.action === 'workspaces.list') {
    const selected = page(navigation.workspaces, args.cursor, args.limit)
    return { ...selected, items: await Promise.all(selected.items.map(workspaceSummary)) }
  }
  const workspace = exact(navigation.workspaces, args.workspace, (item) => item.name, 'Workspace')
  if (args.action === 'chats.create') {
    caller.signal?.throwIfAborted()
    const created = await startNewChat({
      workspaceId: workspace.id,
      directoryId: workspace.directoryId ?? getDesktopWorkingDirectory(),
    })
    if (args.name) renameChatTitle(created.chatId, args.name)
    await refreshShellIndex(created.directoryId)
    return { id: created.conversationId, workspaceId: workspace.id, name: args.name ?? 'New chat' }
  }
  const chats =
    workspace.id === DEFAULT_WORKSPACE_ID
      ? [...workspace.chats, ...navigation.unassignedChats]
      : workspace.chats
  const summaries = chats.map((item): { id: string; name: string; running: boolean | null } => ({
    id: item.conversationId ?? item.id,
    name: item.title,
    running: item.running ?? false,
  }))
  const workspaceAgent = await resolveInstalledWorkspaceAgent(workspace.id)
  if (workspaceAgent && !summaries.some(({ id }) => id === workspaceAgent.mainConversationId))
    summaries.push({ id: workspaceAgent.mainConversationId, name: 'Botmain', running: null })
  if (args.action === 'chats.list') {
    const selected = page(summaries, args.cursor, args.limit)
    return {
      workspaceId: workspace.id,
      ...selected,
      items: selected.items.map((item) => ({
        ...item,
        name: item.name.slice(0, 1000),
        nameTruncated: item.name.length > 1000,
      })),
    }
  }
  const chat = exact(summaries, args.chat, (item) => item.name, 'Chat')
  const conversation = await resolveConversation(chat.id)
  caller.signal?.throwIfAborted()
  return executeChatAction(conversation, args, caller, context)
}
