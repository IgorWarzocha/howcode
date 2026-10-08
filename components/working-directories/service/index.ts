import {
  handledAction,
  unhandledAction,
} from '../../../desktop/app-service/action-router-result.ts'
import { setSidebarVisibleDirectoryIds } from '../../../desktop/app-settings/writers.ts'
import { createServiceWork } from '../../../desktop/runtime/service-work.ts'
import { getDirectoryIds } from '../../../shared/desktop-action-payloads.ts'
import type { DesktopAction } from '../../../shared/desktop-actions.ts'
import type { AnyDesktopActionPayload } from '../../../shared/desktop-contracts.ts'
import type { WorkingDirectoriesService } from '../../../shared/desktop-service-contracts.ts'
import { createDirectoryActionHandler } from './actions/directory-actions.ts'
import { loadDirectoryUsageSummary } from './actions/directory-usage-summary.ts'
import { createWorktreeActionHandler } from './actions/worktree-actions.ts'
import type { WorkingDirectoryPeers } from './dependencies.ts'
import { loadDirectoryFavicon } from './directory-favicon.ts'
import { disposeDirectoryShell, loadDirectoryShell } from './directory-shell.ts'

export function createWorkingDirectoriesService(peers: WorkingDirectoryPeers) {
  const directoryActions = createDirectoryActionHandler(peers)
  const worktreeActions = createWorktreeActionHandler(peers)
  const work = createServiceWork('Working directories')
  const run = work.run
  let disposal: Promise<void> | undefined
  const service: WorkingDirectoriesService = {
    loadDirectoryUsageSummary: (id) => run(() => loadDirectoryUsageSummary(id)),
    loadDirectoryFavicon: (id) => run(() => loadDirectoryFavicon(id)),
  }
  return {
    service,
    handleAction: (action: DesktopAction, payload: AnyDesktopActionPayload) =>
      run(async () => {
        if (action === 'directory.sidebar-scope') {
          setSidebarVisibleDirectoryIds(getDirectoryIds(payload))
          return handledAction()
        }
        const result = await directoryActions(action, payload)
        if (result.handled) return result
        return action.startsWith('worktrees.')
          ? worktreeActions(action, payload)
          : unhandledAction()
      }),
    loadShell: (cwd: string) => run(() => loadDirectoryShell(cwd)),
    dispose() {
      disposal ??= (async () => {
        await work.stop()
        await disposeDirectoryShell()
      })()
      return disposal
    },
  }
}
