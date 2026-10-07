import { join } from 'node:path'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import type { Models } from '@earendil-works/pi-ai'
import {
  type Cursor,
  defineDoc,
  type EntryRecord,
  Harness,
  type Storage,
  UsageDoc,
} from '@earendil-works/pi-durable'
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node'
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { getDurableModels } from '../settings/models.ts'
import { loadPiSettings } from '../settings/preferences.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import { getComposerDefaults } from './defaults.ts'
import {
  bindDesktopExtensions,
  createDesktopExtensionRegistry,
  disposeDesktopExtensions,
  resolveDesktopExtensions,
} from './extension-composition.ts'
import { decodeConversationId, decodeEntryId } from './identity.ts'

export { decodeConversationId, decodeEntryId, decodeSubmissionId } from './identity.ts'

export const runtimeContext = BACKGROUND_CONTEXT
export const RuntimeOriginDoc = defineDoc<{
  appOwned: boolean
  projectId: string | null
  composerMode: 'chat' | 'code' | null
  chatGroupId: string | null
  branchName: string | null
}>({
  kind: 'howcode.origin',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({
    appOwned: false,
    projectId: null,
    composerMode: null,
    chatGroupId: null,
    branchName: null,
  }),
})
let runtime: Promise<Harness> | undefined
let closing = false
let runtimeStorage: Storage | undefined
let shutdown: Promise<void> | undefined
let activeModels: Models | undefined
let preferences: Awaited<ReturnType<typeof loadPiSettings>> | undefined
const extensionRegistry = createDesktopExtensionRegistry()

export async function refreshDurableSettings() {
  const [models, settings] = await Promise.all([getDurableModels(), loadPiSettings()])
  activeModels = models
  preferences = settings
}

async function openRuntime() {
  await refreshDurableSettings()
  const storage = await openNodeSqliteStorage(join(getDesktopUserDataPath(), 'durable.sqlite'))
  try {
    const harness = await Harness.open(
      storage,
      {
        get models() {
          if (!activeModels) throw new Error('Durable model access is unavailable.')
          return activeModels
        },
        registry: extensionRegistry,
        settings: {
          get compaction() {
            return { enabled: preferences?.autoCompact ?? true }
          },
          get steeringMode() {
            return preferences?.steeringMode ?? 'one-at-a-time'
          },
          get followUpMode() {
            return preferences?.followUpMode ?? 'one-at-a-time'
          },
          get stream() {
            return { transport: preferences?.transport ?? 'auto' }
          },
        },
        env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? getDesktopWorkingDirectory() }),
        onReport: (error) => console.error('Durable runtime:', error),
      },
      runtimeContext,
    )
    runtimeStorage = storage
    bindDesktopExtensions(harness)
    harness.resume()
    return harness
  } catch (error) {
    await storage.close(runtimeContext)
    throw error
  }
}

export function getDurableRuntime() {
  if (closing) throw new Error('Durable runtime is closing.')
  runtime ??= openRuntime()
  return runtime
}

export async function resolveConversation(conversationId: string) {
  const harness = await getDurableRuntime()
  const conversation = await harness.conversation(
    decodeConversationId(conversationId),
    runtimeContext,
  )
  if (!conversation) throw new Error(`Conversation not found: ${conversationId}`)
  return conversation
}

export async function createRuntimeConversation(request: ComposerStateRequest = {}) {
  const selection = resolveRuntimeExtensions(request)
  const defaults = getComposerDefaults(request)
  const models = await getDurableModels()
  const defaultModel = (await models.getAvailable())[0]
  const model =
    defaults.model ??
    (defaultModel ? { provider: defaultModel.provider, modelId: defaultModel.id } : undefined)
  const harness = await getDurableRuntime()
  return harness.createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: {
        cwd: request.projectId ?? getDesktopWorkingDirectory(),
        ...(model ? { model } : {}),
        thinkingLevel: defaults.thinkingLevel,
        ...selection,
      },
      init: async (tx, conversationId) => {
        const origin = await tx.doc(RuntimeOriginDoc, conversationId)
        Object.assign(origin, {
          appOwned: true,
          projectId: request.projectId ?? null,
          composerMode: request.composerMode ?? 'code',
          chatGroupId: request.chatGroupId ?? null,
          branchName: request.branchName ?? null,
        })
      },
    },
    runtimeContext,
  )
}

export function resolveRuntimeExtensions(request: ComposerStateRequest) {
  return resolveDesktopExtensions(request, extensionRegistry)
}

export async function listRuntimeConversations() {
  await getDurableRuntime()
  if (!runtimeStorage) throw new Error('Durable storage is unavailable.')
  const ids: string[] = []
  let cursor: Cursor | undefined
  do {
    const page = await runtimeStorage.scanConversations({}, 200, cursor, runtimeContext)
    ids.push(...page.items.map((record) => String(record.id)))
    cursor = page.next
  } while (cursor !== undefined)
  return ids
}

export async function readRuntimeConversationContext(conversationId: string) {
  return (await resolveConversation(conversationId)).agent(runtimeContext)
}

export async function readRuntimeConversationOrigin(conversationId: string) {
  return (await getDurableRuntime()).snapshot(
    RuntimeOriginDoc,
    decodeConversationId(conversationId),
    runtimeContext,
  )
}

export async function readRuntimeEntries(conversationId: string, atEntryId?: string) {
  await getDurableRuntime()
  if (!runtimeStorage) throw new Error('Durable storage is unavailable.')
  const query = {
    conversationId: decodeConversationId(conversationId),
    ...(atEntryId ? { maxEntryId: decodeEntryId(atEntryId) } : {}),
  }
  const entries: EntryRecord[] = []
  let cursor: Cursor | undefined
  do {
    const page = await runtimeStorage.scanEntries(query, 200, cursor, runtimeContext)
    entries.push(...page.items)
    cursor = page.next
  } while (cursor !== undefined)
  return entries.reverse()
}

export async function readRuntimeUsage(conversationId: string) {
  const harness = await getDurableRuntime()
  return (
    (await harness.snapshot(UsageDoc, decodeConversationId(conversationId), runtimeContext)) ?? {
      models: {},
      tools: {},
    }
  )
}

export async function subscribeRuntimeConversationChanges(listener: (id: string) => void) {
  const harness = await getDurableRuntime()
  let active = true
  const unsubscribe = harness.subscribeCommits(({ changes }) => {
    const ids = new Set<string>()
    for (const change of changes) {
      const id =
        change.type === 'document' || change.type === 'document.copy'
          ? change.conversationId
          : change.type === 'conversation'
            ? change.value.id
            : change.value.conversationId
      if (id !== undefined) ids.add(String(id))
    }
    queueMicrotask(() => {
      if (active) for (const id of ids) listener(id)
    })
  })
  return () => {
    active = false
    unsubscribe()
  }
}

export async function abortRuntimeConversation(conversationId: string) {
  const conversation = await resolveConversation(conversationId)
  // Durable retains its spend ledger. App metadata owns deletion visibility.
  await conversation.abort(runtimeContext, { background: true })
}

export function disposeDurableRuntime() {
  if (shutdown) return shutdown
  closing = true
  shutdown = (async () => {
    const harness = runtime ? await runtime : undefined
    try {
      await disposeDesktopExtensions()
    } finally {
      await harness?.close(runtimeContext)
    }
  })()
  return shutdown
}
