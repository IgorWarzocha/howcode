import { gitPostEffectHandlers } from '@howcode/components/git/ui'
import { worktreePostEffectHandlers } from '@howcode/components/working-directories/ui'
import { desktopQueryKeys } from '../query/desktop-query'
import { chatPostEffectHandlers } from './post-effects/chat-handlers'
import type {
  PostEffectHandler,
  PostEffectsContext,
  RunPostDesktopActionEffectsInput,
} from './post-effects/context'
import { shellPostEffectHandlers } from './post-effects/shell-handlers'
import { workspaceOrganizationPostEffect } from './post-effects/workspace-organization'

export { applyDiffPreferencesToChat } from '@howcode/components/git/ui'
export {
  applyOptimisticChatRename,
  applyOptimisticDirectoryRename,
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticSettingsUpdate,
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyUpdatedShellState,
} from './controller-optimistic-updates'

const postEffectHandlers: PostEffectHandler[] = [
  ...shellPostEffectHandlers,
  ...chatPostEffectHandlers,
  ...gitPostEffectHandlers,
  ...worktreePostEffectHandlers,
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
