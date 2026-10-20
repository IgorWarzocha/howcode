import { join } from 'node:path'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import type { Models } from '@earendil-works/pi-ai'
import {
  type Cursor,
  type EntryRecord,
  type Extension,
  Harness,
  type Storage,
  UsageDoc,
} from '@earendil-works/pi-durable'
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node'
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node'
import { createPeopleExtension } from '../../components/people/service/index.ts'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopWorkingDirectory } from '../../shared/desktop-working-directory.ts'
import { loadAppSettings } from '../app-settings/readers.ts'
import { bindInstalledPluginRuntime, unbindPluginRuntime } from '../plugins/runtime.ts'
import { boundPluginRuntime } from '../plugins/runtime-bindings.ts'
import { liveModels } from '../settings/live-models.ts'
import { getDurableModels } from '../settings/models.ts'
import { loadShellPreferences } from '../settings/preferences.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import {
  enableBoardSelectionMigration,
  reconcileCreatedBoardSelection,
} from './board-selection-migration.ts'
import { RuntimeOriginDoc } from './conversation-origin.ts'
import { getComposerDefaults } from './defaults.ts'
import { migrateAcceptedInputTasks } from './delivery-lineage.ts'

export { RuntimeOriginDoc } from './conversation-origin.ts'

import { defaultExtensionExclusions, resolveDesktopExtensions } from './extension-composition.ts'
import { decodeConversationId, decodeEntryId } from './identity.ts'
import { reconcileHumanInputActivity } from './input-admission.ts'
import { migrateConversationCapabilities } from './legacy-capability-migration.ts'
import { openLiveExtensions } from './live-extensions.ts'

export { decodeConversationId, decodeEntryId, decodeSubmissionId } from './identity.ts'

export const runtimeContext = BACKGROUND_CONTEXT
let runtime: Promise<Harness> | undefined
let closing = false
let admissionOpen = true
let admissionClosures = 0
let generationFailure: unknown
let runtimeStorage: Storage | undefined
let shutdown: Promise<void> | undefined
let activeModels: Models | undefined
let preferences: Awaited<ReturnType<typeof loadShellPreferences>> | undefined
let extensions: Promise<Awaited<ReturnType<typeof openExtensions>>> | undefined
type RuntimeDelivery = { extension: Extension; reconcileSources: () => Promise<void> }
let runtimeDelivery: RuntimeDelivery | undefined

/** The service composition root supplies delivery before native acquisition. */
export function bindRuntimeDelivery(delivery: RuntimeDelivery) {
  if (runtimeDelivery) throw new Error('Durable input delivery is already bound.')
  runtimeDelivery = delivery
  return () => {
    if (runtimeDelivery === delivery) runtimeDelivery = undefined
  }
}

function requireRuntimeDelivery() {
  if (!runtimeDelivery) throw new Error('Durable input delivery is not bound.')
  return runtimeDelivery
}

/** Stop new work without interrupting receipt rejoin or settlement of accepted work. */
export function stopDurableAdmission() {
  admissionOpen = false
}

export function assertDurableAdmissionOpen() {
  const restriction = durableAdmissionRestriction()
  if (restriction) throw new Error(restriction.reason)
}

/** Sources retain blocked occurrences instead of failing durable deadlines during retirement. */
export function durableAdmissionRestriction() {
  if (generationFailure !== undefined)
    return {
      status: 'blocked' as const,
      reason:
        'Native component generation is unavailable. Repair the package or restart the backend.',
    }
  if (!admissionOpen)
    return { status: 'blocked' as const, reason: 'Durable input admission is closed.' }
  if (admissionClosures > 0)
    return {
      status: 'blocked' as const,
      reason: 'Native component generation is changing.',
      retryAt: Date.now() + 1_000,
    }
  return undefined
}

/** Generation retirement excludes new acceptance, not accepted native settlement. */
export async function withDurableAdmissionClosed<T>(operation: () => Promise<T>): Promise<T> {
  admissionClosures += 1
  try {
    return await operation()
  } finally {
    admissionClosures -= 1
  }
}

async function openExtensions() {
  const directory = getDesktopUserDataPath()
  return openLiveExtensions(
    {
      directory,
      cwd: getDesktopWorkingDirectory(),
      stateDirectory: join(directory, 'notebook'),
      environmentId: new NodeExecutionEnv({ cwd: getDesktopWorkingDirectory() }).id,
    },
    [requireRuntimeDelivery().extension, createPeopleExtension(() => loadAppSettings().people)],
  )
}

function getExtensions() {
  extensions ??= openExtensions()
  return extensions
}

export async function refreshDurableSettings() {
  const [models, settings] = await Promise.all([getDurableModels(), loadShellPreferences()])
  activeModels = models
  preferences = settings
}

async function migrateRuntimeState(
  harness: Harness,
  storage: Storage,
  installed: Awaited<ReturnType<typeof openExtensions>>,
) {
  const selection = installed.registry.snapshot()
  const agents = selection.extension('howaboua.agents')
  const board = selection.extension('howaboua.board')
  if (agents && board) {
    if (agents.tools?.some((tool) => tool.name === 'board'))
      throw new Error(
        'Standalone Board requires Agents 0.6 or later; bundled Board is still installed.',
      )
    // Registry presence does not prove an old Agents selection included Board.
    // The package owner records only the verified bundled-0.5 cutover.
    if (await installed.packages.requiresBoardSelectionMigration())
      await harness.commit(enableBoardSelectionMigration, runtimeContext)
  }
  await migrateConversationCapabilities(harness, storage, runtimeContext)
  await migrateAcceptedInputTasks(harness, runtimeContext)
}

async function openRuntime() {
  assertDurableAdmissionOpen()
  let storage: Storage | undefined
  let opened: Harness | undefined
  try {
    storage = await openNodeSqliteStorage(join(getDesktopUserDataPath(), 'durable.sqlite'))
    const [, installed] = await Promise.all([refreshDurableSettings(), getExtensions()])
    const { registry, packages } = installed
    const harness = await Harness.open(
      storage,
      {
        models: liveModels(() => {
          installed.assertReady()
          if (!activeModels) throw new Error('Durable model access is unavailable.')
          return activeModels
        }),
        registry,
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
        conversationCreated: reconcileCreatedBoardSelection,
        onReport: (error) => console.error('Durable runtime:', error),
      },
      runtimeContext,
    )
    runtimeStorage = storage
    opened = harness
    await harness.root(runtimeContext)
    await migrateRuntimeState(harness, storage, installed)
    packages.bind(harness)
    await bindInstalledPluginRuntime({ harness, storage })
    await reconcileHumanInputActivity(harness, runtimeContext)
    await requireRuntimeDelivery().reconcileSources()
    assertDurableAdmissionOpen()
    harness.resume()
    return harness
  } catch (error) {
    try {
      if (opened) await opened.close(runtimeContext)
      else await storage?.close(runtimeContext)
      if (opened) await unbindPluginRuntime(opened)
    } catch (cleanup) {
      // Keep the rejected acquisition published. Rebinding after failed cleanup
      // could leave old native invocations using disposed component resources.
      throw new AggregateError([error, cleanup], 'Durable startup and cleanup failed.')
    }
    runtimeStorage = undefined
    // Only a fully cleaned failed acquisition is idle and safe to retry or reload.
    runtime = undefined
    throw error
  }
}

export async function getDurableRuntime() {
  if (closing) throw new Error('Durable runtime is closing.')
  runtime ??= openRuntime()
  return runtime
}

export async function inspectDurableActivity() {
  // Do not open/resume an unused harness merely to decide whether dev can reload.
  if (!runtime) return { tasks: 0, blockedTasks: 0, submissions: 0 }
  const inspection = await (await runtime).inspect(runtimeContext)
  return {
    tasks: inspection.tasks.filter(
      (task) => !task.record.background && task.state.kind !== 'blocked',
    ).length,
    blockedTasks: inspection.tasks.filter((task) => task.state.kind === 'blocked').length,
    submissions: inspection.submissions.filter((submission) => submission.type === 'input').length,
  }
}

/** Refresh only execution admission, never reads or cancellation paths. */
export async function refreshRuntimePackages() {
  await (await getExtensions()).refresh()
}

/** Called inside the admitted service transition, before new input can enter the new generation. */
export async function reconcileRuntimeGeneration() {
  const bound = boundPluginRuntime()
  // Initial inventory/service composition must not acquire or await its own Harness startup.
  if (!(runtime && bound)) return
  try {
    const installed = await getExtensions()
    await installed.refresh()
    await reconcileHumanInputActivity(bound.harness, runtimeContext)
    generationFailure = undefined
  } catch (error) {
    generationFailure = error
    throw error
  }
}

/** Native readiness only; package service separately owns component/renderer activation. */
export async function readRuntimePackageActivation() {
  const installed = await getExtensions()
  await installed.refresh()
  installed.assertReady()
  return installed.packages.activeInventory()
}

export async function resolveConversation(conversationId: string) {
  const harness = boundPluginRuntime()?.harness ?? (await getDurableRuntime())
  const conversation = await harness.conversation(
    decodeConversationId(conversationId),
    runtimeContext,
  )
  if (!conversation) throw new Error(`Conversation not found: ${conversationId}`)
  return conversation
}

export async function resolveDefaultRuntimeAgent(request: ComposerStateRequest = {}) {
  const selection = await resolveRuntimeExtensions(request)
  const defaults = getComposerDefaults(request)
  const models = await getDurableModels()
  const defaultModel = (await models.getAvailable())[0]
  const model =
    defaults.model ??
    (defaultModel ? { provider: defaultModel.provider, modelId: defaultModel.id } : undefined)
  return {
    cwd: request.directoryId ?? getDesktopWorkingDirectory(),
    ...(model ? { model } : {}),
    thinkingLevel: defaults.thinkingLevel,
    ...(request.composerExtensions === undefined
      ? { extensions: { remove: defaultExtensionExclusions() } }
      : selection),
  }
}

export async function createRuntimeConversation(request: ComposerStateRequest = {}) {
  const [agent, harness] = await Promise.all([
    resolveDefaultRuntimeAgent(request),
    getDurableRuntime(),
  ])
  return harness.createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent,
      init: async (tx, conversationId) => {
        const origin = await tx.doc(RuntimeOriginDoc, conversationId)
        Object.assign(origin, {
          appOwned: true,
          directoryId: request.directoryId ?? null,
          workspaceId: request.workspaceId ?? null,
          branchName: request.branchName ?? null,
        })
      },
    },
    runtimeContext,
  )
}

export async function resolveRuntimeExtensions(request: ComposerStateRequest) {
  const installed = await getExtensions()
  await installed.refresh()
  return resolveDesktopExtensions(request, installed.registry)
}

export async function getAvailableRuntimeExtensions() {
  const installed = await getExtensions()
  await installed.refresh()
  return installed.registry
    .snapshot()
    .installed()
    .map((extension) => ({
      name: extension.name,
      tools: (extension.tools ?? []).map((tool) => tool.name),
    }))
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

export async function readRuntimeConversationRecord(conversationId: string) {
  const bound = boundPluginRuntime()
  if (bound) return bound.storage.conversation(decodeConversationId(conversationId), runtimeContext)
  await getDurableRuntime()
  if (!runtimeStorage) throw new Error('Durable storage is unavailable.')
  return runtimeStorage.conversation(decodeConversationId(conversationId), runtimeContext)
}

export async function readRuntimeConversationOrigin(conversationId: string) {
  const harness = boundPluginRuntime()?.harness ?? (await getDurableRuntime())
  const origin = await harness.snapshot(
    RuntimeOriginDoc,
    decodeConversationId(conversationId),
    runtimeContext,
  )
  return origin ?? null
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
  stopDurableAdmission()
  closing = true
  shutdown = (async () => {
    const harness = runtime ? await runtime : undefined
    // Closing joins native invocations. Never retire their services or package
    // resources if that join fails; the backend must report a failed shutdown.
    await harness?.close(runtimeContext)
    if (harness) await unbindPluginRuntime(harness)
    if (extensions) await (await extensions).packages.close()
  })()
  return shutdown
}
