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
import { DEFAULT_WORKSPACE_ID } from '../shared/desktop-workspace-contracts.ts'
import {
  getRuntimeConversationMetadata,
  registerRuntimeConversation,
} from './app-service/conversation-state.ts'
import { loadAppSettings } from './app-settings/readers.ts'
import {
  getLiveChat,
  selectRuntimeConversation,
  watchRuntimeConversation,
} from './durable-runtime/chats.ts'
import { getComposerSkills, getComposerState } from './durable-runtime/composer.ts'
import {
  abortRuntimeConversation,
  createRuntimeConversation,
  decodeEntryId,
  decodeSubmissionId,
  getDurableRuntime,
  RuntimeOriginDoc,
  readRuntimeConversationOrigin,
  refreshRuntimePackages,
  resolveConversation,
  runtimeContext,
} from './durable-runtime/host.ts'
import { prepareRuntimeInput } from './durable-runtime/input.ts'
import { submitTrustedInput } from './durable-runtime/input-ingress.ts'
import type { TrustedInputOrigin } from './durable-runtime/input-origin.ts'
import { migrateAgentCapabilities } from './durable-runtime/legacy-capability-migration.ts'
import {
  admitPluginInput,
  notifyPluginConversationCreated,
  resolveInstalledPeopleInput,
} from './plugins/runtime.ts'
import { emitDesktopEvent, subscribeDesktopEvents } from './runtime/desktop-events.ts'
import { withDirectoryActivity } from './runtime/directory-activity.ts'

export {
  getComposerState,
  setComposerExtensions,
  setComposerModel,
  setComposerThinkingLevel,
} from './durable-runtime/composer.ts'
export { getComposerSkills, getLiveChat, loadAppSettings, subscribeDesktopEvents }

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

export async function publishComposerState(request: ComposerStateRequest = {}) {
  const composer = await getComposerState(request)
  emitDesktopEvent({
    type: 'composer-update',
    directoryId: request.directoryId ?? null,
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
      directoryId: origin?.directoryId ?? request.directoryId ?? getDesktopWorkingDirectory(),
      branchName: origin?.branchName ?? request.branchName,
      workspaceId: origin?.workspaceId ?? request.workspaceId,
    })
  await watchRuntimeConversation({
    ...request,
    directoryId: existing?.directoryId ?? origin?.directoryId ?? request.directoryId,
    workspaceId: origin?.workspaceId ?? request.workspaceId,
    branchName: origin?.branchName ?? request.branchName,
    conversationId,
  })
}

async function notifyCreatedConversation(conversationId: string) {
  const metadata = getRuntimeConversationMetadata(conversationId)
  if (!metadata) throw new Error('Created conversation has no app association.')
  await notifyPluginConversationCreated({
    id: conversationId,
    directoryId: metadata.directoryId,
    workspaceId: metadata.workspaceId ?? DEFAULT_WORKSPACE_ID,
  })
}

export async function startNewChat(
  request: ComposerStateRequest = {},
  options: { purpose?: 'resident' } = {},
) {
  return withDirectoryActivity(request.directoryId ?? getDesktopWorkingDirectory(), async () => {
    const conversation = await createRuntimeConversation(request)
    const conversationId = String(conversation.id)
    await registerConversation(conversationId, request)
    if (options.purpose !== 'resident') await notifyCreatedConversation(conversationId)
    return {
      composer: await publishComposerState({ ...request, conversationId }),
      directoryId: request.directoryId ?? getDesktopWorkingDirectory(),
      conversationId,
      chatId: conversationId,
    }
  })
}

export async function openChatRuntime(request: ComposerStateRequest) {
  if (request.conversationId)
    await watchRuntimeConversation({ ...request, conversationId: request.conversationId })
  return publishComposerState(request)
}

export async function watchConversation(conversationId: string | null) {
  if (!conversationId) return selectRuntimeConversation(null)
  const metadata = getRuntimeConversationMetadata(conversationId)
  if (metadata?.deleted) throw new Error('This conversation has been deleted.')
  const origin = await readRuntimeConversationOrigin(conversationId)
  return selectRuntimeConversation({
    conversationId,
    directoryId: metadata?.directoryId ?? origin?.directoryId,
    workspaceId: metadata?.workspaceId ?? origin?.workspaceId,
    branchName: metadata?.branchName ?? origin?.branchName,
  })
}

export async function sendComposerPrompt(
  request: ComposerStateRequest & {
    personId?: string | undefined
    text: string
    attachments?: ComposerAttachment[]
    streamingBehavior?: ComposerStreamingBehavior | null
  },
  origin: TrustedInputOrigin,
) {
  return withDirectoryActivity(request.directoryId ?? getDesktopWorkingDirectory(), async () => {
    const conversation = request.conversationId
      ? await resolveConversation(request.conversationId)
      : await createRuntimeConversation(request)
    const conversationId = String(conversation.id)
    await registerConversation(conversationId, request)
    if (!request.conversationId) await notifyCreatedConversation(conversationId)
    const behavior = request.streamingBehavior ?? loadAppSettings().composerStreamingBehavior
    if (behavior === 'stop') {
      await conversation.abort(runtimeContext)
      return { outcome: 'stopped' as const, conversationId, chatId: conversationId }
    }
    await refreshRuntimePackages()
    await admitPluginInput(conversationId)
    const compact = parseCompactSlashCommand(request.text)
    if (compact === null) {
      const content = await prepareRuntimeInput(conversation, request)
      const people = resolveInstalledPeopleInput()
      const input = people
        ? await people.prepareInput({ conversationId, personId: request.personId, content })
        : { content }
      await submitTrustedInput(
        conversation,
        {
          ...input,
          whenBusy: behavior,
          origin,
          semantics: { kind: 'conversation' },
        },
        runtimeContext,
      )
    } else await conversation.compact(compact || undefined, runtimeContext)
    await publishComposerState({ ...request, conversationId })
    return { outcome: 'sent' as const, conversationId, chatId: conversationId }
  })
}

export async function stopComposerRun(request: ComposerStateRequest = {}) {
  if (request.conversationId)
    await (await resolveConversation(request.conversationId)).abort(runtimeContext)
  await publishComposerState(request)
  return { ok: true as const }
}

export async function forkConversation(request: ComposerStateRequest & { targetEntryId: string }) {
  if (!request.conversationId) throw new Error('Select a conversation to fork.')
  const parentId = request.conversationId
  return withDirectoryActivity(request.directoryId ?? getDesktopWorkingDirectory(), async () => {
    const parent = await resolveConversation(parentId)
    const metadata = getRuntimeConversationMetadata(parentId)
    if (metadata?.deleted) throw new Error('This conversation has been deleted.')
    const child = await parent.fork(
      decodeEntryId(request.targetEntryId),
      {
        ownership: { kind: 'ownerless' },
        init: async (tx, id) => {
          await migrateAgentCapabilities(tx, id)
          const origin = await tx.doc(RuntimeOriginDoc, id)
          if (metadata)
            Object.assign(origin, {
              appOwned: true,
              directoryId: metadata.directoryId,
              workspaceId: metadata.workspaceId,
              branchName: metadata.branchName,
            })
        },
      },
      runtimeContext,
    )
    const conversationId = String(child.id)
    await registerConversation(conversationId, request)
    await notifyCreatedConversation(conversationId)
    await publishComposerState({ ...request, conversationId })
    return { conversationId, chatId: conversationId, directoryId: request.directoryId ?? undefined }
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
  await publishComposerState(request)
  return outcome === 'settled' ? ('already_settled' as const) : outcome
}

export async function abortWorkspaceConversations(conversationIds: string[]) {
  await Promise.all(conversationIds.map(abortRuntimeConversation))
}
