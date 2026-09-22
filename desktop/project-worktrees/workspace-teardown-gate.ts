import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Semaphore from 'effect/Semaphore'
import { resolveWorkspaceIdentity } from '../workspace-identity.ts'

type WorkspaceActivity = {
  activeOperations: number
  teardownInProgress: boolean
  idle: Deferred.Deferred<void> | null
}

const workspaceActivity = new Map<string, WorkspaceActivity>()
const workspaceAdmission = Semaphore.makeUnsafe(1)

function withWorkspaceAdmission<T>(admit: () => Promise<T>) {
  return Effect.runPromise(
    workspaceAdmission
      .withPermit(Effect.tryPromise({ try: admit, catch: (error) => error }))
      .pipe(Effect.uninterruptible),
  )
}

async function getWorkspaceActivity(projectId: string) {
  const key = await resolveWorkspaceIdentity(projectId)
  const current = workspaceActivity.get(key)
  if (current) return { key, state: current }

  const state: WorkspaceActivity = {
    activeOperations: 0,
    teardownInProgress: false,
    idle: null,
  }
  workspaceActivity.set(key, state)
  return { key, state }
}

function releaseIfIdle(key: string, state: WorkspaceActivity) {
  if (state.activeOperations === 0 && !state.teardownInProgress) {
    workspaceActivity.delete(key)
  }
}

export async function withWorkspaceActivity<T>(projectId: string, operation: () => Promise<T>) {
  const { key, state } = await withWorkspaceAdmission(async () => {
    const activity = await getWorkspaceActivity(projectId)
    if (activity.state.teardownInProgress) {
      throw new Error('Workspace is being removed. Wait for removal to finish.')
    }
    activity.state.activeOperations += 1
    return activity
  })
  try {
    return await operation()
  } finally {
    state.activeOperations -= 1
    if (state.activeOperations === 0) {
      if (state.idle) Deferred.doneUnsafe(state.idle, Effect.void)
      state.idle = null
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
    if (state.activeOperations > 0) {
      state.idle = Deferred.makeUnsafe<void>()
      await Effect.runPromise(Deferred.await(state.idle))
    }
    return await teardown()
  } finally {
    state.teardownInProgress = false
    releaseIfIdle(key, state)
  }
}
