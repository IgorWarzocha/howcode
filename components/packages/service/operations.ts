import {
  defineFeatureOperation,
  type FeatureOperationCaller,
} from '@howaboua/howcode-sdk/feature-operations'
import * as Schema from 'effect/Schema'
import { PackageActivationStageSchema } from '../../../shared/package-activation-contracts.ts'
import type { createPackageActivation } from './activation.ts'
import type { InstalledPackage, PackageManager } from './manager.ts'

const mutation = Schema.Struct({ requestId: Schema.NonEmptyString, source: Schema.NonEmptyString })
const observation = Schema.Struct({
  operationId: Schema.NonEmptyString,
  stage: Schema.optionalKey(PackageActivationStageSchema),
})
const json = Schema.decodeUnknownSync(Schema.Json)

/** UI mutations and all callable transports use the same package manager and activation owner. */
export function createPackageOperations(options: {
  manager: PackageManager
  activation: ReturnType<typeof createPackageActivation>
  serialize<T>(run: () => Promise<T>): Promise<T>
  refresh(): Promise<void>
  inventory(): readonly InstalledPackage[]
  invalidate(): void
}) {
  const inspect = async (operationId: string, stage: 'service' | 'renderer') => {
    const receipt = await options.manager.operation(operationId)
    if (!receipt) throw new Error(`Package operation not found: ${operationId}`)
    await options.refresh()
    return {
      receipt,
      activation: await options.activation.status(receipt, stage, options.inventory()),
      subscriptions: await options.activation.subscriptions(receipt.id),
    }
  }
  const contribution = {
    capability: 'howcode.app-control',
    mcp: true,
  } as const
  return [
    defineFeatureOperation({
      ...contribution,
      name: 'packages.inventory',
      description: 'List installed package sources and revisions',
      schema: Schema.Struct({}),
      execute: async () =>
        json(
          (await options.manager.inventory()).map(({ source, kind, name, revision }) => ({
            source,
            kind,
            ...(name === undefined ? {} : { name }),
            ...(revision === undefined ? {} : { revision }),
          })),
        ),
    }),
    ...(['install', 'update', 'remove'] as const).map((kind) =>
      defineFeatureOperation({
        ...contribution,
        name: `packages.${kind}`,
        description: `${kind === 'install' ? 'Install' : kind === 'update' ? 'Update' : 'Remove'} a trusted package; retain the receipt for activation status`,
        schema: mutation,
        execute: (input, caller) =>
          options.serialize(async () => {
            const receipt = await options.manager.mutate(
              {
                ...input,
                kind,
                ...(caller.kind === 'native'
                  ? { originConversationId: caller.conversationId }
                  : {}),
              },
              { scope: callerScope(caller) },
            )
            await options.refresh()
            options.invalidate()
            return json({
              receipt,
              activation: await options.activation.status(receipt, 'service', options.inventory()),
            })
          }),
      }),
    ),
    defineFeatureOperation({
      ...contribution,
      name: 'packages.status',
      description: 'Inspect the original receipt and exact service or renderer activation',
      schema: observation,
      execute: (input) =>
        options.serialize(async () =>
          json(await inspect(input.operationId, input.stage ?? 'service')),
        ),
    }),
    defineFeatureOperation({
      capability: contribution.capability,
      name: 'packages.continue',
      description: 'Register exact activation continuation and request the current turn to end',
      schema: observation,
      execute: (input, caller) =>
        options.serialize(async () => {
          if (caller.kind !== 'native')
            throw new Error('Activation continuation requires an accepted native agent turn.')
          const receipt = await options.manager.operation(input.operationId)
          if (!receipt) throw new Error(`Package operation not found: ${input.operationId}`)
          const subscription = await options.activation.subscribe(
            receipt,
            input.stage ?? 'service',
            caller,
          )
          if (subscription.delivery.status !== 'pending')
            return json({ subscription, status: 'already-delivered' })
          caller.yield()
          return json({ subscription, status: 'pending', turnEnd: 'requested' })
        }),
    }),
  ]
}

function callerScope(caller: FeatureOperationCaller) {
  return caller.kind === 'native' ? `conversation:${caller.conversationId}` : caller.kind
}
