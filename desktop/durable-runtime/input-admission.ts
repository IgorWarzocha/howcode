import type { Context } from '@earendil-works/chord'
import { type Cursor, type Harness, InboxDoc, LiveDoc, type Tx } from '@earendil-works/pi-durable'
import type {
  InputAdmission,
  InputAdmissionDecision,
  InputPolicyRequest,
} from '@howaboua/howcode-sdk/input-delivery'
import { readTrustedInputData } from '../../shared/input-origin.ts'
import { installedInputSources, resolveInstalledInputPolicy } from '../plugins/runtime.ts'
import { decodeConversationId } from './identity.ts'

/** Policy is mandatory only for new proactive work, never human input or accepted settlement. */
export async function evaluateInputAdmission(
  tx: Tx,
  request: InputAdmission,
): Promise<{ decision: InputAdmissionDecision; policyRequest: InputPolicyRequest }> {
  if (!(request.source && request.scopeId && request.occurrenceId))
    throw new Error('Input admission requires source, scope and occurrence identities.')
  const now = Date.now()
  const live = await tx.doc(LiveDoc, decodeConversationId(request.conversationId))
  let explicitReady = false
  if (request.kind === 'generic') {
    for (const source of installedInputSources()) {
      if (await source.explicitReady(tx, request.scopeId, now)) {
        explicitReady = true
        break
      }
    }
  }
  const policyRequest: InputPolicyRequest = {
    ...request,
    origin: request.origin ?? { kind: 'scheduled', source: request.source },
    now,
    residentBusy: live.run !== undefined,
    explicitReady,
  }
  const policy = resolveInstalledInputPolicy()
  return {
    policyRequest,
    decision: policy
      ? await policy.evaluate(tx, policyRequest)
      : { status: 'blocked', reason: 'Initiative admission policy is unavailable.' },
  }
}

/** Missing Initiative must not make a genuine human prompt unavailable. */
export async function observeHumanInput(tx: Tx, conversationId: string, at: number) {
  await resolveInstalledInputPolicy()?.humanPrompt(tx, { conversationId, at })
}

/** Repair the post-submit observation crash window from native entries and accepted queued inputs. */
export async function reconcileHumanInputActivity(harness: Harness, context: Context) {
  if (!resolveInstalledInputPolicy()) return
  let conversationCursor: Cursor | undefined
  do {
    const conversations = await harness.commit(
      (tx) => tx.scanConversations({}, 100, conversationCursor),
      context,
    )
    for (const conversation of conversations.items) {
      let entryCursor: Cursor | undefined
      do {
        const entries = await harness.commit(async (tx) => {
          const page = await tx.scanEntries({ conversationId: conversation.id }, 100, entryCursor)
          for (const entry of page.items) {
            const input = readTrustedInputData(entry)
            if (input?.origin.kind === 'human-composer')
              await observeHumanInput(tx, String(conversation.id), input.at)
          }
          return page
        }, context)
        entryCursor = entries.next
      } while (entryCursor !== undefined)
      await harness.commit(async (tx) => {
        const inbox = await tx.doc(InboxDoc, conversation.id)
        for (const item of inbox.items) {
          if (item.mode === 'write' || !item.entry) continue
          const input = readTrustedInputData(item.entry)
          if (input?.origin.kind === 'human-composer')
            await observeHumanInput(tx, String(conversation.id), input.at)
        }
      }, context)
    }
    conversationCursor = conversations.next
  } while (conversationCursor !== undefined)
}
