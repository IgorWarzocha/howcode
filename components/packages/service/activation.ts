import { createHash, randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { InputDelivery } from '@howaboua/howcode-sdk/input-delivery'
import * as Schema from 'effect/Schema'
import {
  type PackageActivationOutcome,
  type PackageActivationStage,
  type PackageActivationSubscription,
  PackageActivationSubscriptionSchema,
} from '../../../shared/package-activation-contracts.ts'
import type {
  PackageOperationReceipt,
  PackageOperationTarget,
} from '../../../shared/package-operation-contracts.ts'
import type { createInstalledComponents } from './installed-components.ts'
import type { InstalledPackage, PackageManager } from './manager.ts'
import { packageSourceId } from './source.ts'
import { serializePackageOperation } from './state.ts'

export type PackageOperationHost = {
  inputDelivery: Pick<InputDelivery, 'captureAcceptedWork' | 'submit'>
  /** Successfully published native registry owners, not the desired inventory. */
  activeInventory(): Promise<readonly { source: string; revision: string }[]>
}

type Components = Pick<ReturnType<typeof createInstalledComponents>, 'readiness' | 'retirement'>
const subscriptionsSchema = Schema.Array(PackageActivationSubscriptionSchema)
type ActivationState = Pick<PackageActivationOutcome, 'status' | 'reason'>

function currentTarget(
  target: PackageOperationTarget,
  inventory: readonly InstalledPackage[],
  cwd: string,
) {
  const identity = packageSourceId(target.source, cwd)
  return inventory.find(
    (item) =>
      packageSourceId(item.source, cwd) === identity ||
      (target.name !== undefined && item.name === target.name),
  )
}

function desiredOutcome(
  operation: PackageOperationReceipt,
  target: PackageOperationTarget,
  inventory: readonly InstalledPackage[],
  cwd: string,
): ActivationState | undefined {
  const current = currentTarget(target, inventory, cwd)
  if (operation.kind === 'remove')
    return current
      ? { status: 'superseded', reason: 'The package was installed again.' }
      : undefined
  if (!current) return { status: 'removed', reason: 'The package was removed.' }
  if (current.source !== target.source || current.revision !== target.revision)
    return { status: 'superseded', reason: 'A different package revision is desired.' }
  return undefined
}

function componentOutcome(
  components: Components,
  operation: PackageOperationReceipt,
  target: PackageOperationTarget,
  stage: PackageActivationStage,
): ActivationState | undefined {
  const readiness =
    operation.kind === 'remove'
      ? components.retirement(target.source, target.revision)
      : components.readiness(target.source, target.revision, stage)
  if (readiness.status === 'failed') return { status: 'failed', reason: readiness.error }
  if (readiness.status === 'pending') return { status: 'pending', reason: readiness.reason }
  if (stage === 'renderer' && readiness.status === 'not-component')
    return { status: 'failed', reason: 'This package has no renderer contribution.' }
  return undefined
}

async function nativeOutcome(
  host: PackageOperationHost | undefined,
  operation: PackageOperationReceipt,
): Promise<ActivationState> {
  if (!host) return { status: 'pending', reason: 'Native activation inspection is unavailable.' }
  let active: Awaited<ReturnType<PackageOperationHost['activeInventory']>>
  try {
    active = await host.activeInventory()
  } catch (error) {
    return {
      status: 'failed',
      reason: `Native package activation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  const pending = operation.targets.some((target) => {
    const exact = active.some(
      (item) => item.source === target.source && item.revision === target.revision,
    )
    return operation.kind === 'remove' ? exact : !exact
  })
  return pending
    ? { status: 'pending', reason: 'Waiting for the exact native registry generation.' }
    : { status: 'ready' }
}

/** Feature-owned exact-generation reconciliation; no waiter holds an agent or service lease. */
export function createPackageActivation(options: {
  directory: string
  cwd: string
  manager: PackageManager
  components: Components
  host?: PackageOperationHost
}) {
  const directory = join(options.directory, 'packages')
  const path = join(directory, 'activation-subscriptions.json')
  const serialized = <T>(run: () => Promise<T>) => serializePackageOperation(directory, run)
  const read = async () => {
    try {
      return Schema.decodeUnknownSync(subscriptionsSchema)(JSON.parse(await readFile(path, 'utf8')))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }
  const write = async (records: readonly PackageActivationSubscription[]) => {
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(records), { flag: 'wx', flush: true })
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  async function status(
    operation: PackageOperationReceipt,
    stage: PackageActivationStage,
    inventory: readonly InstalledPackage[],
    nativeHost = options.host,
  ): Promise<PackageActivationOutcome> {
    const identity = { operationId: operation.id, stage }
    if (operation.outcome === 'failed' || operation.outcome === 'interrupted')
      return { ...identity, status: 'failed', reason: operation.error }
    if (operation.outcome === 'preparing')
      return { ...identity, status: 'pending', reason: 'Package inventory has not committed.' }
    for (const target of operation.targets) {
      const outcome =
        desiredOutcome(operation, target, inventory, options.cwd) ??
        componentOutcome(options.components, operation, target, stage)
      if (outcome) return { ...identity, ...outcome }
    }
    return { ...identity, ...(await nativeOutcome(nativeHost, operation)) }
  }

  async function subscribe(
    operation: PackageOperationReceipt,
    stage: PackageActivationStage,
    caller: { conversationId: string; taskId: string },
  ) {
    if (!options.host) throw new Error('Accepted activation continuation is unavailable.')
    if (operation.originConversationId !== caller.conversationId)
      throw new Error('Only the originating conversation can continue this package operation.')
    const id = createHash('sha256')
      .update(JSON.stringify([operation.id, stage, caller.conversationId]))
      .digest('hex')
    const existing = await serialized(async () => (await read()).find((item) => item.id === id))
    if (existing) return existing
    const accepted = await options.host.inputDelivery.captureAcceptedWork(caller)
    return serialized(async () => {
      const records = await read()
      const previous = records.find((item) => item.id === id)
      if (previous) return previous
      const subscription: PackageActivationSubscription = {
        id,
        operationId: operation.id,
        stage,
        conversationId: accepted.conversationId,
        acceptedTaskId: accepted.taskId,
        createdAt: Date.now(),
        delivery: { status: 'pending' },
      }
      // Register first. The next inventory reconciliation closes the snapshot/subscribe race.
      await write([...records, subscription])
      return subscription
    })
  }

  async function reconcile(inventory: readonly InstalledPackage[]) {
    const subscriptions = (await serialized(read)).filter(
      (item) => item.delivery.status === 'pending',
    )
    if (subscriptions.length === 0) return []
    const operations = new Map((await options.manager.operations()).map((item) => [item.id, item]))
    const host = options.host
    let nativeInventory: ReturnType<PackageOperationHost['activeInventory']> | undefined
    const nativeHost = host && {
      ...host,
      // Read-only outcomes share one published native snapshot; no native refresh races its peers.
      activeInventory: () => (nativeInventory ??= host.activeInventory()),
    }
    const outcomes = new Map(
      await Promise.all(
        subscriptions.map(async (subscription) => {
          const operation = operations.get(subscription.operationId)
          const outcome: PackageActivationOutcome = operation
            ? await status(operation, subscription.stage, inventory, nativeHost)
            : {
                operationId: subscription.operationId,
                stage: subscription.stage,
                status: 'failed',
                reason: 'The original package operation receipt is unavailable.',
              }
          return [subscription.id, outcome] as const
        }),
      ),
    )
    return serialized(async () => {
      const records = await read()
      let changed = false
      const next = records.map((item) => {
        const outcome = outcomes.get(item.id)
        if (
          !outcome ||
          item.delivery.status !== 'pending' ||
          JSON.stringify(item.outcome) === JSON.stringify(outcome)
        )
          return item
        changed = true
        return { ...item, outcome }
      })
      if (changed) await write(next)
      return next.filter(
        (item) =>
          item.delivery.status === 'pending' && item.outcome && item.outcome.status !== 'pending',
      )
    })
  }

  async function deliver(subscription: PackageActivationSubscription) {
    if (!(options.host && subscription.outcome)) return
    const receipt = await options.host.inputDelivery.submit({
      source: 'howcode.packages',
      conversationId: subscription.conversationId,
      requestId: `package-activation:${subscription.id}`,
      content: `Package activation outcome: ${JSON.stringify(subscription.outcome)}. Inspect the original package receipt before continuing; do not repeat installation or completed setup side effects.`,
      acceptedWork: {
        conversationId: subscription.conversationId,
        taskId: subscription.acceptedTaskId,
      },
      mode: 'continuation',
    })
    await serialized(async () => {
      const records = await read()
      await write(
        records.map((item) =>
          item.id === subscription.id
            ? {
                ...item,
                delivery:
                  receipt.status === 'unanswered'
                    ? {
                        status: 'unanswered',
                        submissionId: String(receipt.id),
                        reason: receipt.reason,
                      }
                    : { status: 'accepted', submissionId: String(receipt.id) },
              }
            : item,
        ),
      )
    })
  }

  const deliveryFailed = (id: string, error: unknown) =>
    serialized(async () => {
      const records = await read()
      await write(
        records.map((item) =>
          item.id === id && item.delivery.status === 'pending'
            ? { ...item, delivery: { status: 'pending', error: String(error) } }
            : item,
        ),
      )
    })
  const subscriptions = (operationId: string) =>
    serialized(async () => (await read()).filter((item) => item.operationId === operationId))
  return { status, subscribe, reconcile, deliver, deliveryFailed, subscriptions }
}
