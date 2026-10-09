import { useWorkspaceSurfaceHost } from '@howaboua/howcode-sdk/workspace-surfaces'
import type { WorkspaceLayoutRequest } from '@howcode/shared/workspace-layout-contracts'
import { useEffect, useState } from 'react'
import { subscribeDesktopEvents } from '../query/desktop-query'
import {
  useRegisterWorkspaceLayoutActions,
  useWorkspaceLayoutWriteLane,
} from './workspace-layout-actions'
import { connectWorkspaceLayout } from './workspace-layout-sync'

async function requestLayout(request: WorkspaceLayoutRequest) {
  if (!window.piDesktop) throw new Error('Desktop bridge is unavailable.')
  return window.piDesktop.workspaceLayout(request)
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
  const registerActions = useRegisterWorkspaceLayoutActions()
  const lane = useWorkspaceLayoutWriteLane()
  const [status, setStatus] = useState({ message: 'Loading layout…', retry: false })
  useEffect(() => {
    const disconnect = connectWorkspaceLayout({
      host,
      conversationId,
      lane,
      request: requestLayout,
      subscribe: subscribeDesktopEvents,
      onStatus: setStatus,
      onReady: (save) => registerActions({ conversationId, saveDefault: save }),
    })
    return () => {
      disconnect()
      registerActions(null)
    }
  }, [host, conversationId, registerActions, lane])

  if (!status.message) return null
  return (
    <div className="absolute right-2 top-10 z-20 flex items-center gap-2 rounded bg-[var(--panel)] px-2 py-1 text-xs">
      <span role="status">{status.message}</span>
      {status.retry ? (
        <button type="button" onClick={onRetry}>
          Reload layout
        </button>
      ) : null}
    </div>
  )
}
