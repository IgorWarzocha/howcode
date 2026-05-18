import type {
  ComposerStateRequest,
  ComposerStreamingBehavior,
} from '../../shared/desktop-contracts.ts'
import {
  buildComposerQueueSnapshotKey,
  findQueuedPromptIndexById,
  removeQueuedPromptById,
  replayComposerQueue,
} from './composer-queue'
import type { PiRuntime } from './types.ts'

type DequeueComposerPromptRequest = ComposerStateRequest & {
  queueId: string
  queueSnapshotKey: string
  queueMode: Exclude<ComposerStreamingBehavior, 'stop'>
}

async function restoreQueueAfterReplayFailure(input: {
  clearedQueue: ReturnType<PiRuntime['session']['clearQueue']>
  emitComposerUpdate: (request: ComposerStateRequest) => Promise<unknown>
  error: unknown
  request: ComposerStateRequest
  runtime: PiRuntime
  sessionPath: string
}) {
  input.runtime.session.clearQueue()
  try {
    await replayComposerQueue(input.runtime.session, input.clearedQueue)
    await input.emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
  } catch (rollbackError) {
    throw new Error(
      rollbackError instanceof Error
        ? `Could not restore queued prompts after dequeue replay failure: ${rollbackError.message}`
        : 'Could not restore queued prompts after dequeue replay failure.',
    )
  }
  throw input.error
}

async function replayDequeuedComposerQueue(input: {
  clearedQueue: ReturnType<PiRuntime['session']['clearQueue']>
  dequeueResult: NonNullable<ReturnType<typeof removeQueuedPromptById>>
  emitComposerUpdate: (request: ComposerStateRequest) => Promise<unknown>
  request: ComposerStateRequest
  runtime: PiRuntime
  sessionPath: string
}) {
  try {
    await replayComposerQueue(input.runtime.session, input.dequeueResult.nextQueue)
    await input.emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
    return input.dequeueResult.dequeuedText
  } catch (error) {
    await restoreQueueAfterReplayFailure({ ...input, error })
    return null
  }
}

export async function dequeueComposerPromptFromRuntime(input: {
  emitComposerUpdate: (request: ComposerStateRequest) => Promise<unknown>
  request: DequeueComposerPromptRequest
  runtime: PiRuntime
  sessionPath: string
}) {
  const currentQueueSnapshot = {
    steering: [...input.runtime.session.getSteeringMessages()],
    followUp: [...input.runtime.session.getFollowUpMessages()],
  }
  if (buildComposerQueueSnapshotKey(currentQueueSnapshot) !== input.request.queueSnapshotKey) {
    await input.emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
    return null
  }
  const currentQueue =
    input.request.queueMode === 'steer'
      ? currentQueueSnapshot.steering
      : currentQueueSnapshot.followUp
  if (
    findQueuedPromptIndexById(input.request.queueMode, currentQueue, input.request.queueId) === null
  ) {
    await input.emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
    return null
  }
  const clearedQueue = input.runtime.session.clearQueue()
  const dequeueResult = removeQueuedPromptById(
    clearedQueue,
    input.request.queueMode,
    input.request.queueId,
  )
  if (!dequeueResult) {
    await replayComposerQueue(input.runtime.session, clearedQueue)
    await input.emitComposerUpdate({ ...input.request, sessionPath: input.sessionPath })
    return null
  }
  return await replayDequeuedComposerQueue({
    clearedQueue,
    dequeueResult,
    emitComposerUpdate: input.emitComposerUpdate,
    request: input.request,
    runtime: input.runtime,
    sessionPath: input.sessionPath,
  })
}
