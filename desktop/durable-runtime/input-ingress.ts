import type { Context } from '@earendil-works/chord'
import type { Conversation, InputSubmissionDraft } from '@earendil-works/pi-durable'
import type { AcceptedWork, InputSemantics } from '@howaboua/howcode-sdk/input-delivery'
import { watchRuntimeConversation } from './chats.ts'
import { validateAcceptedWork } from './delivery-lineage.ts'
import {
  assertDurableAdmissionOpen,
  getDurableRuntime,
  resolveConversation,
  runtimeContext,
} from './host.ts'
import { observeHumanInput } from './input-admission.ts'
import { setupActionOrigin, stampInputOrigin, type TrustedInputOrigin } from './input-origin.ts'

/** Transport adapters must supply a host-derived origin; model roles carry no authority. */
export async function submitTrustedInput(
  conversation: Conversation,
  request: Omit<InputSubmissionDraft, 'type'> & {
    origin: TrustedInputOrigin
    semantics?: InputSemantics
    acceptedWork?: { source: string; reference: AcceptedWork }
  },
  context: Context,
) {
  if (request.requestId) {
    const existing = await conversation.commit(
      (tx) => tx.submissionByRequest(conversation.id, request.requestId ?? ''),
      context,
    )
    if (existing) {
      if (existing.type !== 'input')
        throw new Error('The request identity belongs to a passive write.')
      // Ordinary ingress retries should use the same native handle, not run prompt observation again.
      const submission = await (await getDurableRuntime()).submission(existing.id, context)
      if (!submission) throw new Error('The native input receipt is missing.')
      return submission
    }
  }
  const accepted = request.acceptedWork
  if (accepted)
    await conversation.commit(
      (tx) =>
        validateAcceptedWork(
          tx,
          accepted.reference,
          String(conversation.id),
          accepted.source,
          'continuation',
        ),
      context,
    )
  else assertDurableAdmissionOpen()
  const at = Date.now()
  const submission = await conversation.submit(
    {
      type: 'input',
      content: request.content,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      ...(request.whenBusy === undefined ? {} : { whenBusy: request.whenBusy }),
      entry: stampInputOrigin(request.origin, at, request.entry, request.semantics),
    },
    context,
  )
  if (request.origin.kind === 'human-composer') {
    // Native submit has no public transaction hook. Observe only after the real receipt exists;
    // recovery repairs from its trusted entry, rather than inventing pre-acceptance human activity.
    await conversation
      .commit((tx) => observeHumanInput(tx, String(conversation.id), at), context)
      .catch((error: unknown) =>
        console.error('Human prompt observation failed after native acceptance:', error),
      )
  }
  return submission
}

/** Dedicated explicit setup request, not a prompt or a proactive producer exemption. */
export async function submitSetupInput(
  request: {
    conversationId: string
    requestId: string
    message: string
  },
  beforeSubmit: () => Promise<void>,
): Promise<void> {
  const conversation = await resolveConversation(request.conversationId)
  const existing = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, request.requestId),
    runtimeContext,
  )
  if (existing) {
    if (existing.type !== 'input') throw new Error('The setup request belongs to a passive write.')
    return
  }
  await beforeSubmit()
  await submitTrustedInput(
    conversation,
    {
      content: request.message,
      requestId: request.requestId,
      whenBusy: 'followUp',
      origin: setupActionOrigin(),
      semantics: { kind: 'operational', label: 'Assistant setup' },
    },
    runtimeContext,
  )
  await watchRuntimeConversation({ conversationId: request.conversationId })
}
