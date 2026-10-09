import {
  createWorkspaceLayoutSnapshot,
  type WorkspaceLayoutSnapshot,
} from '@howaboua/howcode-sdk/workspace-layout-state'
import type { createWorkspaceSurfaceHost } from '@howaboua/howcode-sdk/workspace-surfaces'
import type { DesktopEvent } from '@howcode/shared/desktop-event-contracts'
import type {
  WorkspaceLayoutRequest,
  WorkspaceLayoutResponse,
} from '@howcode/shared/workspace-layout-contracts'

export type WorkspaceLayoutWriteLane = { current: Promise<void> }
export type WorkspaceLayoutStatus = { message: string; retry: boolean }

type LayoutHost = Pick<
  ReturnType<typeof createWorkspaceSurfaceHost>,
  'restoreLayout' | 'exportLayout' | 'subscribeLayout'
>

export function connectWorkspaceLayout({
  host,
  conversationId,
  lane,
  request,
  subscribe,
  onStatus,
  onReady,
}: {
  host: LayoutHost
  conversationId: string
  lane: WorkspaceLayoutWriteLane
  request: (request: WorkspaceLayoutRequest) => Promise<WorkspaceLayoutResponse>
  subscribe: (listener: (event: DesktopEvent) => void) => () => void
  onStatus: (status: WorkspaceLayoutStatus) => void
  onReady: (saveDefault: () => void) => void
}) {
  const lifecycle = new AbortController()
  let unsubscribeLayout: (() => void) | undefined
  let revision = -1
  let epoch = 0
  // A replacement connection must read after the previous connection's saves finish.
  // Keep captured edits on chat switches, but never restore into a disposed view.
  let queue = lane.current
  const report = (message: string, retry = false) => {
    if (!lifecycle.signal.aborted) onStatus({ message, retry })
  }
  const enqueue = (work: () => Promise<void>) => {
    queue = queue.then(work).catch((error: unknown) => {
      epoch += 1
      report(error instanceof Error ? error.message : 'Could not save workspace layout.', true)
    })
    lane.current = queue
  }
  const restore = (response: WorkspaceLayoutResponse) => {
    revision = response.state.revision
    if (!lifecycle.signal.aborted) host.restoreLayout(response.state.layout)
  }
  const refresh = async () => {
    const response = await request({ action: 'read', conversationId })
    if (lifecycle.signal.aborted) return
    if (revision >= 0 && response.state.revision > revision) epoch += 1
    restore(response)
    return response.state.layout
  }
  const unsubscribeEvents = subscribe((event) => {
    if (event.type !== 'workspace-layout-changed' || event.conversationId !== conversationId) return
    enqueue(async () => {
      if (!lifecycle.signal.aborted && event.revision > revision) await refresh()
    })
  })
  const persist = (layout: WorkspaceLayoutSnapshot) => {
    const editEpoch = epoch
    enqueue(async () => {
      if (editEpoch !== epoch) return
      const response = await request({ action: 'save', conversationId, revision, layout })
      revision = response.state.revision
      if (response.status === 'conflict') {
        epoch += 1
        restore(response)
      }
      report('')
    })
  }
  const saveDefault = () => {
    if (lifecycle.signal.aborted) return
    report('Saving default…')
    enqueue(async () => {
      let response = await request({ action: 'save-default', conversationId, revision })
      if (response.status === 'conflict') {
        epoch += 1
        restore(response)
        response = await request({ action: 'save-default', conversationId, revision })
      }
      if (response.status === 'conflict') {
        restore(response)
        report('Could not save the workspace default while the layout is changing. Try again.')
      } else report('Workspace default saved.')
    })
  }
  host.restoreLayout(createWorkspaceLayoutSnapshot())
  enqueue(async () => {
    if (lifecycle.signal.aborted) return
    const restored = await refresh()
    if (lifecycle.signal.aborted) return
    unsubscribeLayout = host.subscribeLayout(persist)
    const mounted = host.exportLayout()
    if (JSON.stringify(mounted) !== JSON.stringify(restored)) persist(mounted)
    onReady(saveDefault)
    report('')
  })
  return () => {
    lifecycle.abort()
    unsubscribeEvents()
    unsubscribeLayout?.()
  }
}
