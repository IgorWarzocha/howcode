import {
  createWorkspaceLayoutSnapshot,
  type WorkspaceLayoutSnapshot,
} from '@howaboua/howcode-sdk/workspace-layout-state'
import { useWorkspaceSurfaceHost } from '@howaboua/howcode-sdk/workspace-surfaces'
import type { WorkspaceLayoutRequest } from '@howcode/shared/workspace-layout-contracts'
import { useEffect, useRef, useState } from 'react'
import { subscribeDesktopEvents } from '../query/desktop-query'

async function requestLayout(request: WorkspaceLayoutRequest) {
  if (!window.piDesktop) throw new Error('Desktop bridge is unavailable.')
  return window.piDesktop.workspaceLayout(request)
}

function connectWorkspaceLayout(
  host: ReturnType<typeof useWorkspaceSurfaceHost>['host'],
  conversationId: string,
  onStatus: (status: { message: string; retry: boolean }) => void,
  onReady: (saveDefault: () => void) => void,
) {
  const lifecycle = new AbortController()
  let unsubscribeLayout: (() => void) | undefined
  let revision = -1
  let epoch = 0
  let queue = Promise.resolve()
  const report = (message: string, retry = false) => {
    if (!lifecycle.signal.aborted) onStatus({ message, retry })
  }
  const enqueue = (work: () => Promise<void>) => {
    queue = queue.then(work).catch((error: unknown) => {
      epoch += 1
      report(error instanceof Error ? error.message : 'Could not save workspace layout.', true)
    })
  }
  const refresh = async () => {
    const response = await requestLayout({ action: 'read', conversationId })
    if (lifecycle.signal.aborted) return
    if (revision >= 0 && response.state.revision > revision) epoch += 1
    revision = response.state.revision
    host.restoreLayout(response.state.layout)
    return response.state.layout
  }
  // A change event can arrive before its own save response; serialize both.
  const unsubscribeEvents = subscribeDesktopEvents((event) => {
    if (event.type !== 'workspace-layout-changed' || event.conversationId !== conversationId) return
    enqueue(async () => {
      if (!lifecycle.signal.aborted && event.revision > revision) await refresh()
    })
  })
  const persist = (layout: WorkspaceLayoutSnapshot) => {
    const editEpoch = epoch
    enqueue(async () => {
      if (editEpoch !== epoch) return
      const response = await requestLayout({ action: 'save', conversationId, revision, layout })
      revision = response.state.revision
      if (response.status === 'conflict') {
        epoch += 1
        if (!lifecycle.signal.aborted) host.restoreLayout(response.state.layout)
        report('Layout changed elsewhere. Latest arrangement loaded; retry your change.', true)
      }
    })
  }
  const saveDefault = () => {
    report('Saving default…')
    enqueue(async () => {
      const response = await requestLayout({ action: 'save-default', conversationId, revision })
      if (response.status === 'conflict') {
        revision = response.state.revision
        epoch += 1
        if (!lifecycle.signal.aborted) host.restoreLayout(response.state.layout)
        report('Layout changed elsewhere. Review it before saving the default.', true)
      } else report('Workspace default saved.')
    })
  }
  host.restoreLayout(createWorkspaceLayoutSnapshot())
  enqueue(async () => {
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

/** The controls may reset per chat; the surface provider and retained content never do. */
export function WorkspaceLayoutControls({ conversationId }: { conversationId: string }) {
  const [attempt, setAttempt] = useState(0)
  return (
    <WorkspaceLayoutSession
      key={`${conversationId}:${attempt}`}
      conversationId={conversationId}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  )
}

function WorkspaceLayoutSession({
  conversationId,
  onRetry,
}: {
  conversationId: string
  onRetry: () => void
}) {
  const { host } = useWorkspaceSurfaceHost()
  const saveDefault = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState({ message: 'Loading layout…', retry: false })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const disconnect = connectWorkspaceLayout(host, conversationId, setStatus, (save) => {
      saveDefault.current = save
      setReady(true)
    })
    return () => {
      disconnect()
      saveDefault.current = null
    }
  }, [host, conversationId])

  return (
    <div className="flex min-w-0 items-center gap-2 px-2 text-xs">
      {ready ? (
        <button type="button" onClick={() => saveDefault.current?.()}>
          Save as workspace default
        </button>
      ) : null}
      {status.message ? <span role="status">{status.message}</span> : null}
      {status.retry ? (
        <button type="button" onClick={onRetry}>
          Reload layout
        </button>
      ) : null}
    </div>
  )
}
