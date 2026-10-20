import { withAbortSignal } from '@earendil-works/chord/context'
import {
  type Cursor,
  defineExtension,
  defineTask,
  type SettledSubmissionRecord,
  type SubmissionRecord,
  type Tx,
} from '@earendil-works/pi-durable'
import type {
  AcceptedWork,
  InputAdmission,
  InputDelivery,
  InputDeliveryRequest,
} from '@howaboua/howcode-sdk/input-delivery'
import { HarnessContextEntry } from '../../shared/harness-context.ts'
import {
  admitPluginInput,
  installedInputSources,
  resolveInstalledInputPolicy,
} from '../plugins/runtime.ts'
import { watchRuntimeConversation } from './chats.ts'
import {
  AcceptedInputTaskDoc,
  captureNativeAcceptedWork,
  stampAcceptedInputTask,
  validateAcceptedWork,
} from './delivery-lineage.ts'
import {
  durableAdmissionRestriction,
  getDurableRuntime,
  resolveConversation,
  runtimeContext,
} from './host.ts'
import { decodeConversationId } from './identity.ts'
import { evaluateInputAdmission } from './input-admission.ts'
import { submitTrustedInput } from './input-ingress.ts'
import {
  acceptAuthorizedInputTask,
  withNativeTaskAuthorization,
} from './input-task-authorization.ts'

type DeliveryTaskInput = InputAdmission & {
  content: InputDeliveryRequest['content']
  whenBusy?: InputDeliveryRequest['whenBusy']
}

const InputDeliveryTask = defineTask<
  DeliveryTaskInput,
  { phase: 'deliver' },
  SettledSubmissionRecord
>({
  name: 'howcode.input-delivery',
  version: 1,
  initial: () => ({ phase: 'deliver' }),
  phases: {
    deliver: async (task, runtime, context) => {
      const receipt = await createInputDelivery().deliver({
        source: task.input.source,
        conversationId: task.input.conversationId,
        requestId: task.input.occurrenceId,
        content: task.input.content,
        acceptedWork: { taskId: String(task.id), conversationId: task.input.conversationId },
        mode: 'continuation',
        signal: runtime.signal,
        ...(task.input.whenBusy === undefined ? {} : { whenBusy: task.input.whenBusy }),
      })
      await runtime.commit(
        () => ({ status: 'terminal', outcome: { status: 'completed', result: receipt } }),
        context,
      )
    },
  },
  abort: async (task, runtime, context) => {
    const receipt = await (await getDurableRuntime()).commit(
      (tx) =>
        tx.submissionByRequest(
          decodeConversationId(task.input.conversationId),
          task.input.occurrenceId,
        ),
      context,
    )
    // Native cancellation can withdraw queued input, not un-place input from a shared run.
    // Conversation abort owns cancellation of a run; do not stop unrelated inputs here.
    if (receipt) await (await getDurableRuntime()).abortSubmission(receipt.id, context)
    await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context)
  },
})

export const InputDeliveryExtension = defineExtension({
  name: 'howcode.input-delivery',
  tasks: [InputDeliveryTask],
})

export async function findAcceptedDeliveryTask(
  tx: Tx,
  request: Pick<InputAdmission, 'source' | 'conversationId' | 'occurrenceId'>,
): Promise<AcceptedWork | undefined> {
  let cursor: Cursor | undefined
  do {
    const page = await tx.scanTasks(
      {
        kind: InputDeliveryTask.definition.name,
        conversationId: decodeConversationId(request.conversationId),
      },
      100,
      cursor,
    )
    for (const task of page.items) {
      const input = task.input
      if (typeof input !== 'object' || input === null || Array.isArray(input)) continue
      const { source, conversationId, occurrenceId } = input
      if (
        source === request.source &&
        conversationId === request.conversationId &&
        occurrenceId === request.occurrenceId
      )
        return { taskId: String(task.id), conversationId: request.conversationId }
    }
    cursor = page.next
  } while (cursor !== undefined)
  return undefined
}

async function receiptByRequest(
  request: InputDeliveryRequest,
): Promise<SubmissionRecord | undefined> {
  const conversation = await resolveConversation(request.conversationId)
  const existing = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, request.requestId),
    runtimeContext,
  )
  if (existing && existing.type !== (request.mode === 'passive' ? 'write' : 'input'))
    throw new Error('The delivery request identity belongs to another native submission type.')
  return existing
}

/** No source state, scheduler or ledger lives here: native task/submission records own acceptance. */
export function createInputDelivery(): InputDelivery {
  return {
    async reconcileSources() {
      const results = await Promise.allSettled(
        installedInputSources().map((source) => source.reconcile?.()),
      )
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) throw failed.reason
    },
    async acceptTask(tx, request, authorization) {
      const marker = await tx.doc(AcceptedInputTaskDoc, request.taskId)
      if (marker.accepted) {
        if (
          marker.source !== request.source ||
          marker.occurrenceId !== request.occurrenceId ||
          marker.conversationId !== request.conversationId ||
          marker.scopeId !== request.scopeId
        )
          throw new Error('Native task admission identity mismatch.')
        return { status: 'accepted' }
      }
      const restriction = durableAdmissionRestriction()
      if (restriction) return restriction
      if (authorization) {
        const policyRequest = await acceptAuthorizedInputTask(tx, request, authorization)
        // Direct or continuing work bypasses restrictions without resuming them.
        // Its actual accepted execution still displaces a redundant generic wake.
        await resolveInstalledInputPolicy()?.accepted(tx, {
          ...policyRequest,
          taskId: request.taskId,
        })
        return { status: 'accepted' }
      }
      const { decision, policyRequest } = await evaluateInputAdmission(tx, request)
      if (decision.status === 'blocked') return decision
      const policy = resolveInstalledInputPolicy()
      if (!policy) throw new Error('Initiative admission policy disappeared during acceptance.')
      await stampAcceptedInputTask(tx, request, policyRequest.now, policyRequest.origin)
      await policy.accepted(tx, { ...policyRequest, taskId: request.taskId })
      return { status: 'accepted' }
    },
    async admitPassive(tx, request) {
      const restriction = durableAdmissionRestriction()
      if (restriction) return restriction
      return (await evaluateInputAdmission(tx, { ...request, kind: 'reminder' })).decision
    },
    async captureAcceptedWork(caller) {
      return (await getDurableRuntime()).commit(
        (tx) => captureNativeAcceptedWork(tx, caller),
        runtimeContext,
      )
    },
    withTaskAuthorization: withNativeTaskAuthorization,
    async submit(request) {
      const context = request.signal
        ? withAbortSignal(request.signal, runtimeContext)
        : runtimeContext
      const existing = await receiptByRequest(request)
      if (existing) return existing
      const conversation = await resolveConversation(request.conversationId)
      const lineage = await conversation.commit(
        (tx) =>
          validateAcceptedWork(
            tx,
            request.acceptedWork,
            request.conversationId,
            request.source,
            request.mode,
          ),
        context,
      )
      if (request.mode === 'passive') {
        const submission = await conversation.submit(
          {
            type: 'write',
            requestId: request.requestId,
            entry: {
              kind: HarnessContextEntry.kind,
              data: {
                sourceConversationId: request.acceptedWork.conversationId,
                label: request.source,
                text:
                  typeof request.content === 'string'
                    ? request.content
                    : request.content
                        .filter((part) => part.type === 'text')
                        .map((part) => part.text)
                        .join('\n'),
              },
              model: [{ role: 'user', content: request.content, timestamp: Date.now() }],
            },
          },
          context,
        )
        return submission.status(context)
      }
      const submission = await submitTrustedInput(
        conversation,
        {
          content: request.content,
          requestId: request.requestId,
          whenBusy: request.whenBusy ?? 'followUp',
          origin: lineage.origin,
          acceptedWork: { source: request.source, reference: request.acceptedWork },
        },
        context,
      )
      await watchRuntimeConversation({ conversationId: request.conversationId })
      return submission.status(context)
    },
    async deliver(request) {
      const context = request.signal
        ? withAbortSignal(request.signal, runtimeContext)
        : runtimeContext
      const receipt = await createInputDelivery().submit(request)
      const submission = await (await getDurableRuntime()).submission(receipt.id, context)
      if (!submission) throw new Error('The accepted delivery native receipt is missing.')
      return submission.wait(context)
    },
    async start(request) {
      const harness = await getDurableRuntime()
      const existing = await harness.commit(
        (tx) => findAcceptedDeliveryTask(tx, request),
        runtimeContext,
      )
      if (existing) return { status: 'accepted', acceptedWork: existing }
      await admitPluginInput(request.conversationId)
      const result = await harness.commit(async (tx) => {
        const rejoined = await findAcceptedDeliveryTask(tx, request)
        if (rejoined) return { status: 'accepted' as const, acceptedWork: rejoined }
        const restriction = durableAdmissionRestriction()
        if (restriction) return restriction
        // Read policy and source readiness before the first native table write.
        const { decision, policyRequest } = await evaluateInputAdmission(tx, request)
        if (decision.status === 'blocked') return decision
        const taskId = await tx.createTask(InputDeliveryTask, request, {
          ownership: { kind: 'conversation' },
          conversationId: decodeConversationId(request.conversationId),
        })
        await stampAcceptedInputTask(
          tx,
          { ...request, taskId },
          policyRequest.now,
          policyRequest.origin,
        )
        const policy = resolveInstalledInputPolicy()
        if (!policy) throw new Error('Initiative admission policy disappeared during acceptance.')
        await policy.accepted(tx, { ...policyRequest, taskId })
        return {
          status: 'accepted' as const,
          acceptedWork: { taskId: String(taskId), conversationId: request.conversationId },
        }
      }, runtimeContext)
      return result
    },
  }
}
