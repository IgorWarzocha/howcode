import { resolveDirectoryIdentity } from '@howaboua/howcode-sdk/node/directory-identity'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Semaphore from 'effect/Semaphore'

type DirectoryActivity = {
  activeOperations: number
  teardownInProgress: boolean
  idle: Deferred.Deferred<void> | null
}

const directoryActivity = new Map<string, DirectoryActivity>()
const directoryAdmission = Semaphore.makeUnsafe(1)

function withDirectoryAdmission<T>(admit: () => Promise<T>) {
  return Effect.runPromise(
    directoryAdmission
      .withPermit(Effect.tryPromise({ try: admit, catch: (error) => error }))
      .pipe(Effect.uninterruptible),
  )
}

async function getDirectoryActivity(directoryId: string) {
  const key = await resolveDirectoryIdentity(directoryId)
  const current = directoryActivity.get(key)
  if (current) return { key, state: current }

  const state: DirectoryActivity = {
    activeOperations: 0,
    teardownInProgress: false,
    idle: null,
  }
  directoryActivity.set(key, state)
  return { key, state }
}

function releaseIfIdle(key: string, state: DirectoryActivity) {
  if (state.activeOperations === 0 && !state.teardownInProgress) {
    directoryActivity.delete(key)
  }
}

export async function withDirectoryActivity<T>(directoryId: string, operation: () => Promise<T>) {
  const { key, state } = await withDirectoryAdmission(async () => {
    const activity = await getDirectoryActivity(directoryId)
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

export async function withDirectoryTeardown<T>(directoryId: string, teardown: () => Promise<T>) {
  const { key, state } = await withDirectoryAdmission(async () => {
    const activity = await getDirectoryActivity(directoryId)
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
