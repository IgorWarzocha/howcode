import path from 'node:path'

type WorkspaceActivity = {
  activeSessionStarts: number
  teardownInProgress: boolean
  resolveIdle: (() => void) | null
}

const workspaceActivity = new Map<string, WorkspaceActivity>()

function getWorkspaceActivity(projectId: string) {
  const key = path.resolve(projectId)
  const current = workspaceActivity.get(key)
  if (current) return { key, state: current }

  const state: WorkspaceActivity = {
    activeSessionStarts: 0,
    teardownInProgress: false,
    resolveIdle: null,
  }
  workspaceActivity.set(key, state)
  return { key, state }
}

function releaseIfIdle(key: string, state: WorkspaceActivity) {
  if (state.activeSessionStarts === 0 && !state.teardownInProgress) {
    workspaceActivity.delete(key)
  }
}

export async function withWorkspaceSessionStart<T>(projectId: string, start: () => Promise<T>) {
  const { key, state } = getWorkspaceActivity(projectId)
  if (state.teardownInProgress) {
    throw new Error('Workspace is being removed. Wait for removal to finish.')
  }

  state.activeSessionStarts += 1
  try {
    return await start()
  } finally {
    state.activeSessionStarts -= 1
    if (state.activeSessionStarts === 0) {
      state.resolveIdle?.()
      state.resolveIdle = null
    }
    releaseIfIdle(key, state)
  }
}

export async function withWorkspaceTeardown<T>(projectId: string, teardown: () => Promise<T>) {
  const { key, state } = getWorkspaceActivity(projectId)
  if (state.teardownInProgress) {
    throw new Error('Workspace removal is already in progress.')
  }

  state.teardownInProgress = true
  try {
    if (state.activeSessionStarts > 0) {
      await new Promise<void>((resolve) => {
        state.resolveIdle = resolve
      })
    }
    return await teardown()
  } finally {
    state.teardownInProgress = false
    releaseIfIdle(key, state)
  }
}
