import { desktopQueryKeys } from '../query/desktop-query'
import type {
  PostEffectHandler,
  PostEffectsContext,
  RunPostDesktopActionEffectsInput,
} from './post-effects/context'
import { shellPostEffectHandlers } from './post-effects/shell-handlers'
import { threadPostEffectHandlers } from './post-effects/thread-handlers'
import { workspacePostEffectHandlers } from './post-effects/workspace-handlers'

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
export { applyDiffPreferencesToThread } from './post-effects/diff-preferences'

const postEffectHandlers: PostEffectHandler[] = [
  ...shellPostEffectHandlers,
  ...threadPostEffectHandlers,
  ...workspacePostEffectHandlers,
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
