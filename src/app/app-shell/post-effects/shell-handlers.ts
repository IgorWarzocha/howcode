import {
  setShellSidebarVisibleDirectoryIds,
  updateShellDirectory,
  upsertShellDirectory,
} from '@howcode/components/working-directories/ui'
import { getPersistedConversationId } from '@howcode/shared/conversation-ids'
import type { ShellState } from '../../desktop/types'
import { desktopQueryKeys } from '../../query/desktop-query'
import { hasActionError } from '../controller-action-utils'
import type { PostEffectHandler } from './context'
import { applyNewChatPostEffect } from './new-chat'

export const shellPostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'composer.set-extensions' && !hasActionError(ctx.actionResult),
    run: (ctx) => {
      const conversationId =
        typeof ctx.contextualPayload.conversationId === 'string'
          ? ctx.contextualPayload.conversationId
          : null
      if (getPersistedConversationId(conversationId)) return
      const extensions = ctx.actionResult?.result?.composer?.selectedExtensions
      if (!Array.isArray(extensions)) return
      ctx.dispatch({
        type: 'set-composer-extensions',
        extensions: extensions.filter((name): name is string => typeof name === 'string'),
        conversationId: ctx.workspaceState.selectedConversationId,
        directoryId: ctx.workspaceState.selectedDirectoryId,
        workspaceId: ctx.workspaceState.selectedWorkspaceId,
      })
    },
  },
  {
    matches: (ctx) => Boolean(ctx.actionResult?.result?.composer),
    run: (ctx) => {
      if (ctx.actionResult?.result?.composer) ctx.setComposerState(ctx.actionResult.result.composer)
    },
  },
  {
    matches: (ctx) => ctx.action === 'directory.refresh-repo-origin',
    run: (ctx) => {
      const directoryId = ctx.actionResult?.result?.directoryId ?? ctx.contextualPayload.directoryId
      const originUrl = ctx.actionResult?.result?.originUrl
      if (typeof directoryId !== 'string') return
      updateShellDirectory(ctx.queryClient, directoryId, (directory) =>
        directory.repoOriginUrl === originUrl && directory.repoOriginChecked === true
          ? directory
          : { ...directory, repoOriginUrl: originUrl ?? null, repoOriginChecked: true },
      )
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'shell-preferences.import-pi' ||
      (ctx.action === 'shell-preferences.update' &&
        ctx.contextualPayload.shellPreferencesKey === 'theme'),
    run: (ctx) => {
      const { shellPreferences, piTheme } = ctx.actionResult?.result ?? {}
      if (!(shellPreferences && piTheme)) return ctx.refreshShellState()
      ctx.queryClient.setQueryData<ShellState | null>(
        desktopQueryKeys.shellState(),
        (currentState) =>
          currentState ? { ...currentState, shellPreferences, piTheme } : currentState,
      )
    },
  },
  {
    matches: (ctx) => ctx.action === 'directory.pin',
    run: (ctx) => {
      const directoryId =
        typeof ctx.contextualPayload.directoryId === 'string'
          ? ctx.contextualPayload.directoryId
          : null
      if (!directoryId) return
      updateShellDirectory(ctx.queryClient, directoryId, (directory) => ({
        ...directory,
        pinned: !directory.pinned,
      }))
    },
  },
  {
    matches: (ctx) => ctx.action === 'chat.new' || ctx.action === 'directory.add',
    run: (ctx) => {
      if (ctx.action !== 'chat.new' && ctx.action !== 'directory.add') return
      return applyNewChatPostEffect({
        action: ctx.action,
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        workspaceState: ctx.workspaceState,
        composerDirectoryId: ctx.composerDirectoryId,
        queryClient: ctx.queryClient,
        dispatch: ctx.dispatch,
        refreshShellState: ctx.refreshShellState,
        loadDirectoryChats: ctx.loadDirectoryChats,
        loadComposerState: ctx.loadComposerState,
        setComposerState: ctx.setComposerState,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'directory.sidebar-scope',
    run: (ctx) => {
      const directoryIds = Array.isArray(ctx.contextualPayload.directoryIds)
        ? ctx.contextualPayload.directoryIds.filter(
            (directoryId): directoryId is string => typeof directoryId === 'string',
          )
        : []
      setShellSidebarVisibleDirectoryIds(ctx.queryClient, directoryIds)
    },
  },
  {
    matches: (ctx) => ctx.action === 'directories.import.apply',
    run: async (ctx) => {
      const importedDirectories = ctx.actionResult?.result?.importedDirectories
      if (!Array.isArray(importedDirectories)) {
        await ctx.refreshShellState()
        return
      }
      for (const directory of importedDirectories) upsertShellDirectory(ctx.queryClient, directory)
    },
  },
]
