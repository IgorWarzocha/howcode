import { randomUUID } from 'node:crypto'
import * as Schema from 'effect/Schema'
import {
  type PackageMutationRequest,
  type PackageOperationCaller,
  PackageOperationCallerSchema,
  type PackageOperationReceipt,
  type PackageOperationTarget,
} from '../../../shared/package-operation-contracts.ts'
import { type PackageRecord, readPackageState, writePackageState } from './state.ts'

export type PackageMutationPlan<T> = {
  targets: PackageOperationTarget[]
  run(): Promise<{ packages: PackageRecord[]; targets: PackageOperationTarget[]; value: T }>
  cleanup?(): Promise<void>
}

async function failureMessage(
  error: unknown,
  cleanup: (() => Promise<void>) | undefined,
): Promise<string> {
  const message = error instanceof Error ? error.message : String(error)
  try {
    await cleanup?.()
    return message
  } catch (cleanupError) {
    return `${message}; package cleanup failed: ${String(cleanupError)}`
  }
}

/** The caller holds the inventory barrier throughout preparation, external work and commit. */
export async function runPackageOperation<T>(
  path: string,
  request: PackageMutationRequest,
  context: PackageOperationCaller,
  prepare: (packages: PackageRecord[]) => PackageMutationPlan<T>,
): Promise<{ receipt: PackageOperationReceipt; value?: T }> {
  const caller = Schema.decodeUnknownSync(PackageOperationCallerSchema)(context)
  const state = await readPackageState(path)
  const previous = state.operations.find(
    (operation) =>
      operation.callerScope === caller.scope && operation.requestId === request.requestId,
  )
  if (previous) {
    if (
      previous.kind !== request.kind ||
      previous.source !== request.source ||
      previous.originConversationId !== request.originConversationId
    )
      throw new Error(
        `Package request ID is already bound to a different operation: ${request.requestId}`,
      )
    return { receipt: previous }
  }
  const plan = prepare(state.packages)
  const intent: PackageOperationReceipt = {
    ...request,
    id: randomUUID(),
    callerScope: caller.scope,
    createdAt: Date.now(),
    targets: plan.targets,
    outcome: 'preparing',
  }
  await writePackageState(path, { ...state, operations: [...state.operations, intent] })
  try {
    const result = await plan.run()
    const receipt: PackageOperationReceipt = {
      ...intent,
      targets: result.targets,
      outcome: 'committed',
    }
    await writePackageState(path, {
      ...state,
      packages: result.packages,
      operations: [...state.operations, receipt],
    })
    return { receipt, value: result.value }
  } catch (error) {
    const receipt: PackageOperationReceipt = {
      ...intent,
      outcome: 'failed',
      error: await failureMessage(error, plan.cleanup),
    }
    await writePackageState(path, { ...state, operations: [...state.operations, receipt] })
    return { receipt }
  }
}
