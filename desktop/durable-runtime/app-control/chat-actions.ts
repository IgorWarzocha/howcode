import type { Context } from '@earendil-works/chord'
import { type Conversation, LiveDoc, type SubmissionRecord } from '@earendil-works/pi-durable'
import type { AppControlCaller, AppControlResult } from '../../../shared/app-control.ts'
import { DEFAULT_WORKSPACE_ID } from '../../../shared/desktop-workspace-contracts.ts'
import { getRuntimeConversationMetadata } from '../../app-service/conversation-state.ts'
import { admitPluginInput } from '../../plugins/runtime.ts'
import { captureNativeSettlement } from '../delivery-lineage.ts'
import {
  getDurableRuntime,
  readRuntimeConversationRecord,
  refreshRuntimePackages,
} from '../host.ts'
import { prepareRuntimeInput } from '../input.ts'
import { createInputDelivery, findAcceptedDeliveryTask } from '../input-delivery.ts'
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
type SendAction = Extract<TargetAction, { action: 'chats.send' }>

async function admitNewChatInput(
  conversation: Conversation,
  args: SendAction,
  caller: AppControlCaller,
  source: string,
  context: Context,
) {
  const id = String(conversation.id)
  await refreshRuntimePackages()
  await admitPluginInput(id)
  context.abortSignal?.throwIfAborted()
  const content = await prepareRuntimeInput(conversation, {
    conversationId: id,
    text: args.message,
  })
  context.abortSignal?.throwIfAborted()
  const metadata = getRuntimeConversationMetadata(id)
  if (!metadata) throw new Error('New agent input requires a known target workspace scope.')
  const admission = await createInputDelivery().start({
    source,
    scopeId: metadata.workspaceId ?? DEFAULT_WORKSPACE_ID,
    occurrenceId: args.requestId,
    conversationId: id,
    kind: 'explicit',
    content,
    semantics: {
      kind: 'operational',
      label: caller.kind === 'native' ? 'Agent message' : 'MCP message',
    },
    origin:
      caller.kind === 'native'
        ? { kind: 'agent', conversationId: caller.conversationId, taskId: caller.taskId }
        : { kind: 'mcp' },
  })
  return { ...admission, content }
}

async function assertStopDoesNotJoinCaller(target: string, caller: AppControlCaller) {
  const seen = new Set<string>()
  let current = caller.kind === 'native' ? caller.conversationId : undefined
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
  args: SendAction,
  caller: AppControlCaller,
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
  const id = String(conversation.id)
  const delivery = createInputDelivery()
  const source = caller.kind === 'native' ? 'howcode.agent-message' : 'howcode.mcp-message'
  const acceptedTask = await conversation.commit(
    (tx) =>
      findAcceptedDeliveryTask(tx, {
        source,
        conversationId: id,
        occurrenceId: args.requestId,
      }),
    context,
  )
  if (acceptedTask) return { id, accepted: true, taskId: acceptedTask.taskId, submission: null }
  let acceptedWork =
    caller.kind === 'native'
      ? await conversation.commit((tx) => captureNativeSettlement(tx, caller, id), context)
      : undefined
  let content: Parameters<typeof delivery.start>[0]['content'] = args.message
  if (!acceptedWork) {
    const admission = await admitNewChatInput(conversation, args, caller, source, context)
    if (admission.status === 'blocked')
      return { id, accepted: false, reason: admission.reason, retryAt: admission.retryAt ?? null }
    acceptedWork = admission.acceptedWork
    content = admission.content
  }
  const submission = await delivery.submit({
    source,
    conversationId: id,
    requestId: args.requestId,
    content,
    acceptedWork,
    mode: 'continuation',
    semantics: {
      kind: 'operational',
      label: caller.kind === 'native' ? 'Agent message' : 'MCP message',
    },
    ...(context.abortSignal ? { signal: context.abortSignal } : {}),
  })
  return {
    id: String(conversation.id),
    accepted: true,
    submission: receipt(submission),
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
      return sendChat(conversation, args, caller, context)
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
