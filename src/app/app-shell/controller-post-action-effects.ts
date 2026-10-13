import { getGitRendererApi } from '../git-integration/client'
import { desktopQueryKeys } from '../query/desktop-query'
import { hasActionError } from './controller-action-utils'
import { chatPostEffectHandlers } from './post-effects/chat-handlers'
import type {
  PostEffectHandler,
  PostEffectsContext,
  RunPostDesktopActionEffectsInput,
} from './post-effects/context'
import { shellPostEffectHandlers } from './post-effects/shell-handlers'
import { workspaceOrganizationPostEffect } from './post-effects/workspace-organization'

export {
  applyOptimisticChatRename,
  applyOptimisticDirectoryRename,
  applyOptimisticPinUpdate,
  applyOptimisticSettingsUpdate,
  applyOptimisticShellPreferencesUpdate,
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedShellPreferencesState,
  getOptimisticallyUpdatedShellState,
} from './controller-optimistic-updates'

const postEffectHandlers: PostEffectHandler[] = [
  ...shellPostEffectHandlers,
  ...chatPostEffectHandlers,
  {
    matches: (ctx) => ctx.action.startsWith('git.'),
    run: async (ctx) => {
      const api = getGitRendererApi()
      if (!api) return
      const shared = {
        contextualPayload: ctx.contextualPayload,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      }
      if (ctx.action === 'git.commit-options')
        await api.applyCommitOptionsPostEffect({
          ...shared,
          refreshShellState: ctx.refreshShellState,
        })
      if (ctx.action === 'git.write-file')
        await api.applyWorkspaceFileWritePostEffect({
          ...shared,
          written: ctx.actionResult?.result?.fileWrite?.kind === 'written',
        })
      if (ctx.action === 'git.commit')
        await api.applyWorkspaceCommitPostEffect({
          ...shared,
          committed: ctx.actionResult?.result?.committed === true,
        })
      if (ctx.action === 'git.diff-preferences' && !hasActionError(ctx.actionResult))
        await api.applyDiffPreferencesPostEffect({
          contextualPayload: ctx.contextualPayload,
          updateConversation: (conversationId, patch) => {
            ctx.queryClient.setQueryData(
              desktopQueryKeys.chat(conversationId),
              (current: import('../desktop/types').ChatData | undefined) =>
                api.applyDiffPreferencesToChat(current, patch),
            )
            ctx.setLiveChatData((current) =>
              current?.conversationId === conversationId
                ? (api.applyDiffPreferencesToChat(current, patch) ?? null)
                : current,
            )
          },
          invalidateConversation: (conversationId) =>
            ctx.queryClient.invalidateQueries({
              queryKey: desktopQueryKeys.chatPrefix(conversationId),
            }),
        })
    },
  },
  workspaceOrganizationPostEffect,
]

export async function runPostDesktopActionEffects(input: RunPostDesktopActionEffectsInput) {
  const ctx: PostEffectsContext = {
    ...input,
    invalidateInboxChats: () =>
      input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxChats() }),
  }

  await Promise.all(
    postEffectHandlers.flatMap((handler) => (handler.matches(ctx) ? [handler.run(ctx)] : [])),
  )
}
