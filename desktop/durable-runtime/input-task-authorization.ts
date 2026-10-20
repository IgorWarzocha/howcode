import { LiveDoc, type TaskId, type Tx } from '@earendil-works/pi-durable'
import type {
  InputAdmission,
  InputPolicyRequest,
  InputTaskAuthorization,
} from '@howaboua/howcode-sdk/input-delivery'
import {
  AcceptedInputTaskDoc,
  captureNativeAcceptedWork,
  decodeTaskId,
  stampAcceptedInputTask,
} from './delivery-lineage.ts'
import { getDurableRuntime, runtimeContext } from './host.ts'
import { decodeConversationId } from './identity.ts'
import {
  releaseInputAuthorization,
  resolveInputAuthorization,
  retainInputAuthorization,
} from './input-authorization.ts'

export async function withNativeTaskAuthorization<T>(
  caller: { conversationId: string; taskId: string; signal?: AbortSignal },
  operation: (authorize: () => Promise<InputTaskAuthorization>) => Promise<T>,
): Promise<T> {
  let token: InputTaskAuthorization | undefined
  const authorize = async () => {
    caller.signal?.throwIfAborted()
    if (token) return token
    const harness = await getDurableRuntime()
    const nativeRun = await harness.commit(async (tx) => {
      await captureNativeAcceptedWork(tx, caller)
      return (await tx.doc(AcceptedInputTaskDoc, decodeTaskId(caller.taskId))).nativeRun
    }, runtimeContext)
    caller.signal?.throwIfAborted()
    token = retainInputAuthorization({
      origin: { kind: 'agent', conversationId: caller.conversationId, taskId: caller.taskId },
      nativeRun,
      ...(caller.signal ? { signal: caller.signal } : {}),
    })
    return token
  }
  try {
    return await operation(authorize)
  } finally {
    if (token) releaseInputAuthorization(token)
  }
}

/** Runs after source task creation: documents only, using earlier host/native validation. */
export async function acceptAuthorizedInputTask(
  tx: Tx,
  request: InputAdmission & { taskId: TaskId },
  token: InputTaskAuthorization,
): Promise<InputPolicyRequest> {
  const authorization = resolveInputAuthorization(token)
  if (request.kind !== 'explicit')
    throw new Error('Direct task authorization applies only to explicit work.')
  authorization.signal?.throwIfAborted()
  const now = Date.now()
  await stampAcceptedInputTask(tx, request, now, authorization.origin)
  const marker = await tx.doc(AcceptedInputTaskDoc, request.taskId)
  marker.nativeRun = authorization.nativeRun
  const live = await tx.doc(LiveDoc, decodeConversationId(request.conversationId))
  return {
    ...request,
    origin: authorization.origin,
    now,
    residentBusy: live.run !== undefined,
    explicitReady: false,
  }
}
