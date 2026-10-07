import {
  fallbackAppSlashCommands,
  parseCompactSlashCommand,
} from '../shared/composer-slash-commands.ts'
import type {
  ComposerAttachment,
  ComposerStateRequest,
  ComposerStreamingBehavior,
} from '../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../shared/desktop-working-directory.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import { getComposerState } from './durable-runtime/composer.ts'
import {
  createRuntimeConversation,
  decodeEntryId,
  decodeSubmissionId,
  deleteRuntimeConversation,
  getDurableRuntime,
  RuntimeOriginDoc,
  readRuntimeConversationOrigin,
  resolveConversation,
  runtimeContext,
} from './durable-runtime/host.ts'
import { prepareRuntimeInput } from './durable-runtime/input.ts'
import {
  disposeRuntimeWatches,
  getLiveThread,
  selectRuntimeConversation,
  watchRuntimeConversation,
} from './durable-runtime/threads.ts'
import {
  getRuntimeConversationMetadata,
  registerRuntimeConversation,
} from './pi-threads/conversation-state.ts'
import { withWorkspaceActivity } from './project-worktrees/workspace-teardown-gate.ts'
import { getComposerSkills } from './resources/discovery.ts'
import { emitDesktopEvent, subscribeDesktopEvents } from './runtime/desktop-events.ts'

export {
  getComposerState,
  setComposerModel,
  setComposerThinkingLevel,
} from './durable-runtime/composer.ts'
export { getComposerSkills, getLiveThread, loadAppSettings, subscribeDesktopEvents }

export async function getComposerSlashCommands(request: ComposerStateRequest = {}) {
  const skills = await getComposerSkills(request)
  return [
    ...fallbackAppSlashCommands,
    ...skills.map((skill) => ({
      name: `skill:${skill.name}`,
      description: skill.description,
      source: 'skill' as const,
    })),
  ]
}

async function publishComposer(request: ComposerStateRequest = {}) {
  const composer = await getComposerState(request)
  emitDesktopEvent({
    type: 'composer-update',
    projectId: request.projectId ?? null,
    conversationId: request.conversationId ?? null,
    composer,
  })
  return composer
}

async function registerConversation(conversationId: string, request: ComposerStateRequest) {
  const existing = getRuntimeConversationMetadata(conversationId)
  if (existing?.deleted) throw new Error('This conversation has been deleted.')
  const origin = await readRuntimeConversationOrigin(conversationId)
  if (!existing)
    registerRuntimeConversation({
      conversationId,
      projectId: origin?.projectId ?? request.projectId ?? getDesktopWorkingDirectory(),
      branchName: origin?.branchName ?? request.branchName,
      chatGroupId: origin?.chatGroupId ?? request.chatGroupId,
      isChat: (origin?.composerMode ?? request.composerMode) === 'chat',
    })
  await watchRuntimeConversation({
    ...request,
    projectId: existing?.projectId ?? origin?.projectId ?? request.projectId,
    composerMode: origin?.composerMode ?? request.composerMode,
    chatGroupId: origin?.chatGroupId ?? request.chatGroupId,
    branchName: origin?.branchName ?? request.branchName,
    conversationId,
  })
}

export async function startNewThread(request: ComposerStateRequest = {}) {
  return withWorkspaceActivity(request.projectId ?? getDesktopWorkingDirectory(), async () => {
    const conversation = await createRuntimeConversation(request)
    const conversationId = String(conversation.id)
    await registerConversation(conversationId, request)
    return {
      composer: await publishComposer({ ...request, conversationId }),
      projectId: request.projectId ?? getDesktopWorkingDirectory(),
      conversationId,
      threadId: conversationId,
    }
  })
}

export const selectProjectRuntime = publishComposer

export async function openThreadRuntime(request: ComposerStateRequest) {
  if (request.conversationId)
    await watchRuntimeConversation({ ...request, conversationId: request.conversationId })
  return publishComposer(request)
}

export async function watchConversation(conversationId: string | null) {
  if (!conversationId) return selectRuntimeConversation(null)
  const metadata = getRuntimeConversationMetadata(conversationId)
  if (metadata?.deleted) throw new Error('This conversation has been deleted.')
  const origin = await readRuntimeConversationOrigin(conversationId)
  return selectRuntimeConversation({
    conversationId,
    projectId: metadata?.projectId ?? origin?.projectId,
    composerMode: metadata?.isChat ? 'chat' : origin?.composerMode,
    chatGroupId: metadata?.chatGroupId ?? origin?.chatGroupId,
    branchName: metadata?.branchName ?? origin?.branchName,
  })
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & {
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior | null
  },
) {
  return withWorkspaceActivity(request.projectId ?? getDesktopWorkingDirectory(), async () => {
    const conversation = request.conversationId
      ? await resolveConversation(request.conversationId)
      : await createRuntimeConversation(request)
    const conversationId = String(conversation.id)
    await registerConversation(conversationId, request)
    const behavior = request.streamingBehavior ?? loadAppSettings().composerStreamingBehavior
    if (behavior === 'stop') {
      await conversation.abort(runtimeContext)
      return { outcome: 'stopped' as const, conversationId, threadId: conversationId }
    }
    const compact = parseCompactSlashCommand(request.text)
    if (compact === null) {
      await conversation.submit(
        {
          type: 'input',
          content: await prepareRuntimeInput(conversation, request),
          whenBusy: behavior,
        },
        runtimeContext,
      )
    } else await conversation.compact(compact || undefined, runtimeContext)
    await publishComposer({ ...request, conversationId })
    return { outcome: 'sent' as const, conversationId, threadId: conversationId }
  })
}

export async function stopComposerRun(request: ComposerStateRequest = {}) {
  if (request.conversationId)
    await (await resolveConversation(request.conversationId)).abort(runtimeContext)
  await publishComposer(request)
  return { ok: true as const }
}

export async function forkConversation(request: ComposerStateRequest & { targetEntryId: string }) {
  if (!request.conversationId) throw new Error('Select a conversation to fork.')
  const parentId = request.conversationId
  return withWorkspaceActivity(request.projectId ?? getDesktopWorkingDirectory(), async () => {
    const parent = await resolveConversation(parentId)
    const metadata = getRuntimeConversationMetadata(parentId)
    if (metadata?.deleted) throw new Error('This conversation has been deleted.')
    const child = await parent.fork(
      decodeEntryId(request.targetEntryId),
      {
        ownership: { kind: 'ownerless' },
        init: async (tx, id) => {
          const origin = await tx.doc(RuntimeOriginDoc, id)
          if (metadata)
            Object.assign(origin, {
              projectId: metadata.projectId,
              composerMode: metadata.isChat ? 'chat' : 'code',
              chatGroupId: metadata.chatGroupId,
              branchName: metadata.branchName,
            })
        },
      },
      runtimeContext,
    )
    const conversationId = String(child.id)
    await registerConversation(conversationId, request)
    await publishComposer({ ...request, conversationId })
    return { conversationId, threadId: conversationId, projectId: request.projectId ?? undefined }
  })
}

export async function dequeueComposerPrompt(request: ComposerStateRequest & { queueId: string }) {
  if (!request.conversationId) throw new Error('Select a conversation to cancel a queued input.')
  const outcome = await (await getDurableRuntime()).abortSubmission(
    decodeSubmissionId(request.queueId),
    runtimeContext,
    (await resolveConversation(request.conversationId)).id,
  )
  if (outcome === 'not_found') throw new Error('Queued submission not found in this conversation.')
  await publishComposer(request)
  return outcome === 'settled' ? ('already_settled' as const) : outcome
}

export async function disposeWorkspaceComposerRuns(request: {
  projectPath: string
  conversationIds: string[]
}) {
  await Promise.all(request.conversationIds.map(deleteRuntimeConversation))
}

export const disposeThreadUpdateForwarding = disposeRuntimeWatches
