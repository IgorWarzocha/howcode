import { hasActionError } from '../../app-shell/controller-action-utils'
import type { PostEffectHandler } from '../../app-shell/post-effects/context'
import { applyDiffPreferencesPostEffect } from './diff-preferences'

import {
  applyCommitOptionsPostEffect,
  applyWorkspaceCommitPostEffect,
  applyWorkspaceFileWritePostEffect,
} from './git'
export const gitPostEffectHandlers: PostEffectHandler[] = [
  {
    matches: (ctx) => ctx.action === 'git.commit-options',
    run: (ctx) =>
      applyCommitOptionsPostEffect({
        contextualPayload: ctx.contextualPayload,
        refreshShellState: ctx.refreshShellState,
        loadDirectoryGitState: ctx.loadDirectoryGitState,
        setDirectoryGitState: ctx.setDirectoryGitState,
      }),
  },
  {
    matches: (ctx) => ctx.action === 'git.diff-preferences',
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
    matches: (ctx) => ctx.action === 'git.write-file',
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
    matches: (ctx) => ctx.action === 'git.commit',
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
