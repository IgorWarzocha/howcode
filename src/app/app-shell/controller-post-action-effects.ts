import { workspacePostEffectHandlers } from '@howcode/components/coding/ui'
import { desktopQueryKeys } from '../query/desktop-query'
import type {
  PostEffectHandler,
  PostEffectsContext,
  RunPostDesktopActionEffectsInput,
} from './post-effects/context'
import { shellPostEffectHandlers } from './post-effects/shell-handlers'
import { threadPostEffectHandlers } from './post-effects/thread-handlers'
import { workspaceOrganizationPostEffect } from './post-effects/workspace-organization'

export { applyDiffPreferencesToThread } from '@howcode/components/coding/ui'
export {
  applyOptimisticPinUpdate,
  applyOptimisticPiSettingsUpdate,
  applyOptimisticProjectRename,
  applyOptimisticSettingsUpdate,
  applyOptimisticThreadRename,
  getOptimisticallyPinnedShellState,
  getOptimisticallyRenamedShellState,
  getOptimisticallyUpdatedPiSettingsState,
  getOptimisticallyUpdatedShellState,
} from './controller-optimistic-updates'

const postEffectHandlers: PostEffectHandler[] = [
  ...shellPostEffectHandlers,
  ...threadPostEffectHandlers,
  ...workspacePostEffectHandlers,
  workspaceOrganizationPostEffect,
]

export async function runPostDesktopActionEffects(input: RunPostDesktopActionEffectsInput) {
  const ctx: PostEffectsContext = {
    ...input,
    invalidateInboxThreads: () =>
      input.queryClient.invalidateQueries({ queryKey: desktopQueryKeys.inboxThreads() }),
  }

  await Promise.all(
    postEffectHandlers.flatMap((handler) => (handler.matches(ctx) ? [handler.run(ctx)] : [])),
  )
}
