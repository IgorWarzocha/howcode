import { resolveWorkspaceIdentity } from '../workspace-identity.ts'

type WorkspaceActivity = {
  activeSessionStarts: number
  teardownInProgress: boolean
  resolveIdle: (() => void) | null
}

const workspaceActivity = new Map<string, WorkspaceActivity>()
let workspaceAdmissionTail = Promise.resolve()

function withWorkspaceAdmission<T>(admit: () => Promise<T>) {
  const precedingAdmission = workspaceAdmissionTail
  let releaseAdmission: (() => void) | undefined
  workspaceAdmissionTail = new Promise<void>((resolve) => {
    releaseAdmission = resolve
  })

  return (async () => {
    await precedingAdmission
    try {
      return await admit()
    } finally {
      releaseAdmission?.()
    }
  })()
}

async function getWorkspaceActivity(projectId: string) {
  const key = await resolveWorkspaceIdentity(projectId)
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
  const { key, state } = await withWorkspaceAdmission(async () => {
    const activity = await getWorkspaceActivity(projectId)
    if (activity.state.teardownInProgress) {
      throw new Error('Workspace is being removed. Wait for removal to finish.')
    }
    activity.state.activeSessionStarts += 1
    return activity
  })
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
  const { key, state } = await withWorkspaceAdmission(async () => {
    const activity = await getWorkspaceActivity(projectId)
    if (activity.state.teardownInProgress) {
      throw new Error('Workspace removal is already in progress.')
    }
    activity.state.teardownInProgress = true
    return activity
  })
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
