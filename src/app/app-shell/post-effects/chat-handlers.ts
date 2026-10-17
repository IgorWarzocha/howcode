import { updateShellDirectory } from '@howcode/components/working-directories/ui'
import type { ChatData } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import { hasActionError } from '../controller-action-utils'
import { reconcileComposerChatResult } from '../sidebar-chat-sync'
import {
  applyArchivedChatPostEffect,
  applyChatOpenOrInboxPostEffect,
  applyDirectoryArchiveChatsPostEffect,
  applyDirectoryRemovePostEffect,
  applyRestoreOrDeleteChatPostEffect,
  refreshArchivedIfVisible,
} from './chat-lifecycle'
import type { PostEffectHandler, PostEffectsContext } from './context'

function getChatLifecycleInput(ctx: PostEffectsContext) {
  return {
    action: ctx.action,
    contextualPayload: ctx.contextualPayload,
    actionResult: ctx.actionResult,
    workspaceState: ctx.workspaceState,
    queryClient: ctx.queryClient,
    dispatch: ctx.dispatch,
    loadArchivedChats: ctx.loadArchivedChats,
    loadDirectoryChats: ctx.loadDirectoryChats,
    refreshShellState: ctx.refreshShellState,
    setArchivedChats: ctx.setArchivedChats,
    invalidateInboxChats: ctx.invalidateInboxChats,
  }
}

function getChatRenameContext(ctx: PostEffectsContext) {
  const result = ctx.actionResult?.result
  return {
    directoryId:
      typeof result?.directoryId === 'string'
        ? result.directoryId
        : typeof ctx.contextualPayload.directoryId === 'string'
          ? ctx.contextualPayload.directoryId
          : null,
    conversationId:
      typeof result?.conversationId === 'string'
        ? result.conversationId
        : typeof ctx.contextualPayload.conversationId === 'string'
          ? ctx.contextualPayload.conversationId
          : null,
    chatId:
      typeof result?.chatId === 'string'
        ? result.chatId
        : typeof ctx.contextualPayload.chatId === 'string'
          ? ctx.contextualPayload.chatId
          : null,
    title:
      typeof result?.title === 'string'
        ? result.title
        : typeof ctx.contextualPayload.value === 'string'
          ? ctx.contextualPayload.value.trim()
          : '',
  }
}

function isRenamedChat(
  chat: { id: string; conversationId?: string | null | undefined },
  input: { chatId: string; conversationId: string | null },
) {
  return chat.id === input.chatId || chat.conversationId === input.conversationId
}

function renameCachedDirectoryChats(
  ctx: PostEffectsContext,
  input: { directoryId: string; conversationId: string | null; chatId: string; title: string },
) {
  ctx.queryClient.setQueryData<{ id: string; conversationId?: string | null; title: string }[]>(
    desktopQueryKeys.directoryChats(input.directoryId),
    (current) =>
      current?.map((chat) => (isRenamedChat(chat, input) ? { ...chat, title: input.title } : chat)),
  )
}

async function handleChatRenameEffects(ctx: PostEffectsContext) {
  const { directoryId, conversationId, chatId, title } = getChatRenameContext(ctx)
  if (hasActionError(ctx.actionResult)) {
    if (directoryId) {
      await ctx.loadDirectoryChats(directoryId)
    }
    return
  }
  if (!(chatId && title)) return

  if (directoryId) {
    updateShellDirectory(ctx.queryClient, directoryId, (directory) => ({
      ...directory,
      chats: directory.chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
    }))
    renameCachedDirectoryChats(ctx, { directoryId, conversationId, chatId, title })
  }

  ctx.setWorkspaceNavigationState((currentState) =>
    currentState
      ? {
          ...currentState,
          unassignedChats: currentState.unassignedChats.map((chat) =>
            isRenamedChat(chat, { chatId, conversationId }) ? { ...chat, title } : chat,
          ),
          workspaces: currentState.workspaces.map((group) => ({
            ...group,
            chats: group.chats.map((chat) =>
              isRenamedChat(chat, { chatId, conversationId }) ? { ...chat, title } : chat,
            ),
          })),
        }
      : currentState,
  )

  ctx.setLiveChatData((current) =>
    current && (!conversationId || current.conversationId === conversationId)
      ? { ...current, title }
      : current,
  )
  if (conversationId) {
    ctx.queryClient.setQueriesData<ChatData | null>(
      { queryKey: desktopQueryKeys.chatPrefix(conversationId) },
      (current) => (current ? { ...current, title } : current),
    )
  }
  await ctx.invalidateInboxChats()
}

export const chatPostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'composer.conversation.fork',
    run: async (ctx) => {
      if (hasActionError(ctx.actionResult)) return
      const result = ctx.actionResult?.result
      const conversationId = result?.conversationId
      const chatId = result?.chatId
      const directoryId = result?.directoryId ?? ctx.composerDirectoryId
      if (!(conversationId && chatId)) return
      ctx.dispatch({
        type: 'open-chat',
        directoryId,
        chatId,
        conversationId,
      })
      ctx.setLiveChatData(() => null)
      ctx.setComposerState(null)
      await Promise.all([ctx.loadDirectoryChats(directoryId), ctx.refreshShellState()])
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'chat.pin' ||
      ctx.action === 'chat.archive' ||
      ctx.action === 'chat.archive-many' ||
      ctx.action === 'chat.assign-branch',
    run: (ctx) => applyArchivedChatPostEffect(getChatLifecycleInput(ctx)),
  },
  {
    matches: (ctx) =>
      ctx.action === 'chat.restore' ||
      ctx.action === 'chat.restore-many' ||
      ctx.action === 'chat.delete' ||
      ctx.action === 'chat.delete-many',
    run: (ctx) => applyRestoreOrDeleteChatPostEffect(getChatLifecycleInput(ctx)),
  },
  {
    matches: (ctx) =>
      ctx.action === 'chat.open' ||
      ctx.action === 'inbox.mark-read' ||
      ctx.action === 'inbox.dismiss' ||
      ctx.action === 'inbox.clear-read',
    run: (ctx) => applyChatOpenOrInboxPostEffect(getChatLifecycleInput(ctx)),
  },
  { matches: (ctx) => ctx.action === 'chat.rename', run: handleChatRenameEffects },
  {
    matches: (ctx) => ctx.action === 'directory.archive-chats',
    run: (ctx) => applyDirectoryArchiveChatsPostEffect(getChatLifecycleInput(ctx)),
  },
  {
    matches: (ctx) => ctx.action === 'directory.remove',
    run: (ctx) =>
      applyDirectoryRemovePostEffect({
        ...getChatLifecycleInput(ctx),
        hasActionError: hasActionError(ctx.actionResult),
      }),
  },
  {
    matches: (ctx) => ctx.action === 'composer.send',
    run: (ctx) =>
      reconcileComposerChatResult({
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        workspaceState: ctx.workspaceState,
        queryClient: ctx.queryClient,
        dispatch: ctx.dispatch,
        setWorkspaceNavigationState: ctx.setWorkspaceNavigationState,
        setLiveChatData: ctx.setLiveChatData,
      }),
  },
  {
    matches: (ctx) => ctx.action === 'directory.edit-name',
    run: async (ctx) => {
      const directoryId =
        typeof ctx.contextualPayload.directoryId === 'string'
          ? ctx.contextualPayload.directoryId
          : null
      const directoryName =
        typeof ctx.contextualPayload.directoryName === 'string'
          ? ctx.contextualPayload.directoryName
          : null
      if (directoryId && directoryName) {
        updateShellDirectory(ctx.queryClient, directoryId, (directory) =>
          directory.name === directoryName ? directory : { ...directory, name: directoryName },
        )
      }
      await refreshArchivedIfVisible(getChatLifecycleInput(ctx))
    },
  },
]
