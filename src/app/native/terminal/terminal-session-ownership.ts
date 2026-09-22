import type { TerminalCleanupAction } from './terminal-session-policy'

export type TerminalSessionRelease = {
  sessionId: string
  action: TerminalCleanupAction
}

type OpeningViewport = {
  active: boolean
  identity: string
  status: 'opening'
}

type AdoptedViewport = {
  identity: string
  sessionId: string
  status: 'adopted'
}

type ViewportState = OpeningViewport | AdoptedViewport
type Viewport = object

type DeferredRelease = TerminalSessionRelease & { identity: string }

export function getTerminalViewportIdentity(input: {
  launchMode: 'shell' | 'pi-session'
  projectId: string
  sessionPath: string | null
}) {
  return JSON.stringify({
    projectId: input.projectId,
    sessionPath: input.sessionPath,
    launchMode: input.launchMode,
  })
}

export function createTerminalSessionOwnership() {
  const viewports = new Map<Viewport, ViewportState>()
  const adoptedViewports = new Map<string, Set<Viewport>>()
  const deferredReleases = new Map<string, DeferredRelease>()

  const hasActiveOpeningViewport = (identity: string) =>
    viewports
      .values()
      .some(
        (viewport) =>
          viewport.status === 'opening' && viewport.active && viewport.identity === identity,
      )

  const takeReadyReleases = (identity: string) => {
    if (hasActiveOpeningViewport(identity)) return []

    const releases: TerminalSessionRelease[] = []
    for (const [sessionId, release] of deferredReleases) {
      if (release.identity !== identity) continue
      deferredReleases.delete(sessionId)
      if (!adoptedViewports.has(sessionId)) {
        releases.push({ sessionId, action: release.action })
      }
    }
    return releases
  }

  const deferRelease = (identity: string, release: TerminalSessionRelease) => {
    if (adoptedViewports.has(release.sessionId)) return
    deferredReleases.set(release.sessionId, { ...release, identity })
  }

  const begin = (identity: string) => {
    const viewport: Viewport = {}
    viewports.set(viewport, { active: true, identity, status: 'opening' })
    return viewport
  }

  const opened = (viewport: Viewport, release: TerminalSessionRelease) => {
    const state = viewports.get(viewport)
    if (state?.status !== 'opening') {
      return false
    }

    if (!state.active) {
      viewports.delete(viewport)
      deferRelease(state.identity, release)
      return false
    }

    viewports.set(viewport, {
      identity: state.identity,
      sessionId: release.sessionId,
      status: 'adopted',
    })
    const owners = adoptedViewports.get(release.sessionId) ?? new Set<Viewport>()
    owners.add(viewport)
    adoptedViewports.set(release.sessionId, owners)
    deferredReleases.delete(release.sessionId)
    return true
  }

  const failed = (viewport: Viewport) => {
    const state = viewports.get(viewport)
    if (state?.status !== 'opening') return
    viewports.delete(viewport)
  }

  const leave = (viewport: Viewport, action: TerminalCleanupAction) => {
    const state = viewports.get(viewport)
    if (!state) return

    if (state.status === 'opening') {
      viewports.set(viewport, { ...state, active: false })
      return
    }

    viewports.delete(viewport)
    const owners = adoptedViewports.get(state.sessionId)
    owners?.delete(viewport)
    if (owners?.size === 0) adoptedViewports.delete(state.sessionId)

    deferRelease(state.identity, { sessionId: state.sessionId, action })
  }

  return { begin, failed, leave, opened, takeReadyReleases }
}
