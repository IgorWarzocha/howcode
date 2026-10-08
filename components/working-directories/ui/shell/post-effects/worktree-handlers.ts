import { hasActionError } from '../../../../../src/app/app-shell/controller-action-utils'
import type {
  PostEffectHandler,
  PostEffectsContext,
} from '../../../../../src/app/app-shell/post-effects/context'

function mutationFailedWithoutChanges(ctx: PostEffectsContext) {
  return hasActionError(ctx.actionResult) && ctx.actionResult?.result?.didMutate !== true
}

import {
  applyCreateWorktreePostEffect,
  applyRemoveWorktreePostEffect,
  applySwitchBranchPostEffect,
  applyWorktreeMetadataPostEffect,
} from './worktrees'
export const worktreePostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'git.switch-branch' || ctx.action === 'worktrees.prune-branch',
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
    matches: (ctx) => ctx.action === 'worktrees.create-worktree',
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
      ctx.action === 'worktrees.mark-worktree-complete' ||
      ctx.action === 'worktrees.mark-worktree-incomplete' ||
      ctx.action === 'worktrees.set-worktree-directory',
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
      ctx.action === 'worktrees.remove-worktree' ||
      ctx.action === 'worktrees.merge-worktree' ||
      ctx.action === 'worktrees.merge-completed-worktrees' ||
      ctx.action === 'worktrees.remove-completed-worktrees',
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
]
