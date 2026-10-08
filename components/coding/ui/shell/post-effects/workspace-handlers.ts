import { hasActionError } from '../../../../../src/app/app-shell/controller-action-utils'
import type {
  PostEffectHandler,
  PostEffectsContext,
} from '../../../../../src/app/app-shell/post-effects/context'
import { applyDiffPreferencesPostEffect } from './diff-preferences'
import {
  applyCommitOptionsPostEffect,
  applyCreateWorktreePostEffect,
  applyRemoveWorktreePostEffect,
  applySwitchBranchPostEffect,
  applyWorkspaceCommitPostEffect,
  applyWorkspaceFileWritePostEffect,
  applyWorktreeMetadataPostEffect,
} from './workspace'

function mutationFailedWithoutChanges(ctx: PostEffectsContext) {
  return hasActionError(ctx.actionResult) && ctx.actionResult?.result?.didMutate !== true
}

export const workspacePostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'coding.commit-options',
    run: (ctx) =>
      applyCommitOptionsPostEffect({
        contextualPayload: ctx.contextualPayload,
        refreshShellState: ctx.refreshShellState,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      }),
  },
  {
    matches: (ctx) => ctx.action === 'coding.switch-branch' || ctx.action === 'coding.prune-branch',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applySwitchBranchPostEffect({
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        loadDirectoryChats: ctx.loadDirectoryChats,
        setDirectoryGitState: ctx.setDirectoryGitState,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'coding.create-worktree',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyCreateWorktreePostEffect({
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      })
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'coding.mark-worktree-complete' ||
      ctx.action === 'coding.mark-worktree-incomplete' ||
      ctx.action === 'coding.set-worktree-directory',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyWorktreeMetadataPostEffect({
        action: ctx.action,
        contextualPayload: ctx.contextualPayload,
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      })
    },
  },
  {
    matches: (ctx) =>
      ctx.action === 'coding.remove-worktree' ||
      ctx.action === 'coding.merge-worktree' ||
      ctx.action === 'coding.merge-completed-worktrees' ||
      ctx.action === 'coding.remove-completed-worktrees',
    run: (ctx) => {
      if (mutationFailedWithoutChanges(ctx)) return
      return applyRemoveWorktreePostEffect({
        actionResult: ctx.actionResult,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'coding.diff-preferences',
    run: (ctx) => {
      if (hasActionError(ctx.actionResult)) return
      return applyDiffPreferencesPostEffect({
        contextualPayload: ctx.contextualPayload,
        queryClient: ctx.queryClient,
        setLiveChatData: ctx.setLiveChatData,
      })
    },
  },
  {
    matches: (ctx) => ctx.action === 'coding.write-file',
    run: (ctx) =>
      applyWorkspaceFileWritePostEffect({
        contextualPayload: ctx.contextualPayload,
        written: ctx.actionResult?.result?.fileWrite?.kind === 'written',
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      }),
  },
  {
    matches: (ctx) => ctx.action === 'coding.commit',
    run: (ctx) =>
      applyWorkspaceCommitPostEffect({
        contextualPayload: ctx.contextualPayload,
        committed: ctx.actionResult?.result?.committed === true,
        queryClient: ctx.queryClient,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      }),
  },
]
