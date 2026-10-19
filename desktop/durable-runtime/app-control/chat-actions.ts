import type { Context } from '@earendil-works/chord'
import { type Conversation, LiveDoc, type SubmissionRecord } from '@earendil-works/pi-durable'
import type { AppControlCaller, AppControlResult } from '../../../shared/app-control.ts'
import { admitPluginInput } from '../../plugins/runtime.ts'
import { watchRuntimeConversation } from '../chats.ts'
import {
  getDurableRuntime,
  readRuntimeConversationRecord,
  refreshRuntimePackages,
} from '../host.ts'
import { prepareRuntimeInput } from '../input.ts'
import type { AppControlInput } from './input.ts'
import { readChat } from './read.ts'

function receipt(record: SubmissionRecord): AppControlResult {
  const detail = JSON.stringify(record.detail ?? null)
  return {
    submissionId: String(record.id),
    requestId: record.requestId ?? null,
    status: record.status,
    completed: record.status === 'done' || record.status === 'unanswered',
    entryId: record.entry === undefined ? null : String(record.entry),
    answerEntryId: record.answer === undefined ? null : String(record.answer),
    reason: record.reason?.slice(0, 2000) ?? null,
    detail: detail.slice(0, 4000),
    detailTruncated: detail.length > 4000,
  }
}

type TargetAction = Extract<AppControlInput, { chat: string }>

async function assertStopDoesNotJoinCaller(target: string, caller: AppControlCaller) {
  const seen = new Set<string>()
  let current = caller.conversationId
  while (current && !seen.has(current)) {
    if (current === target)
      throw new Error(
        'Cannot join a stop of the executing chat or its owner. Stop it from another chat or client.',
      )
    seen.add(current)
    const record = await readRuntimeConversationRecord(current)
    current = record?.owner ? String(record.owner.conversationId) : undefined
  }
}

async function submissionStatus(conversation: Conversation, requestId: string, context: Context) {
  const record = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, requestId),
    context,
  )
  if (!record)
    throw new Error('Request not found in this chat. Use the requestId supplied to chats.send.')
  return { id: String(conversation.id), submission: receipt(record) }
}

async function sendChat(
  conversation: Conversation,
  args: Extract<TargetAction, { action: 'chats.send' }>,
  context: Context,
) {
  const existing = await conversation.commit(
    (tx) => tx.submissionByRequest(conversation.id, args.requestId),
    context,
  )
  if (existing) {
    if (existing.type !== 'input')
      throw new Error(
        'This requestId belongs to a passive write. Use a different requestId for new input.',
      )
    return { id: String(conversation.id), accepted: true, submission: receipt(existing) }
  }
  await refreshRuntimePackages()
  await admitPluginInput(String(conversation.id))
  context.abortSignal?.throwIfAborted()
  const content = await prepareRuntimeInput(conversation, {
    conversationId: String(conversation.id),
    text: args.message,
  })
  context.abortSignal?.throwIfAborted()
  const submission = await conversation.submit(
    { type: 'input', content, requestId: args.requestId, whenBusy: 'followUp' },
    context,
  )
  // The existing watch owns UI publication and component turn cleanup after admission.
  await watchRuntimeConversation({ conversationId: String(conversation.id) })
  return {
    id: String(conversation.id),
    accepted: true,
    submission: receipt(await submission.status(context)),
  }
}

export async function executeChatAction(
  conversation: Conversation,
  args: TargetAction,
  caller: AppControlCaller,
  context: Context,
): Promise<AppControlResult> {
  const id = String(conversation.id)
  switch (args.action) {
    case 'chats.stop':
      await assertStopDoesNotJoinCaller(id, caller)
      await conversation.abort(context)
      return { id, stopped: true }
    case 'chats.send':
      return sendChat(conversation, args, context)
    case 'chats.status': {
      if (args.requestId) return submissionStatus(conversation, args.requestId, context)
      const live = await (await getDurableRuntime()).snapshot(LiveDoc, conversation.id, context)
      return {
        id,
        running: live?.run !== undefined,
        taskId: live?.run ? String(live.run.taskId) : null,
        activeSubmissions: (live?.run?.inputs ?? []).slice(0, 50).map(String),
        activeSubmissionsTruncated: (live?.run?.inputs.length ?? 0) > 50,
      }
    }
    case 'chats.read':
      return readChat(conversation, args.cursor, args.limit ?? 20, context)
    default: {
      const unreachable: never = args
      throw new Error(`Unsupported chat action: ${String(unreachable)}`)
    }
  }
}
