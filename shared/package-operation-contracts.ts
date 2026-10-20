import * as Schema from 'effect/Schema'

export const PackageMutationInputSchema = Schema.Struct({
  requestId: Schema.NonEmptyString,
  kind: Schema.Literals(['install', 'update', 'remove']),
  source: Schema.NonEmptyString,
})
export type PackageMutationInput = typeof PackageMutationInputSchema.Type

/** Internal request: the gateway supplies the conversation from trusted caller context. */
export const PackageMutationRequestSchema = Schema.Struct({
  ...PackageMutationInputSchema.fields,
  originConversationId: Schema.optionalKey(Schema.NonEmptyString),
})
export type PackageMutationRequest = typeof PackageMutationRequestSchema.Type

/** Host-derived identity, never an operation payload field. */
export const PackageOperationCallerSchema = Schema.Struct({ scope: Schema.NonEmptyString })
export type PackageOperationCaller = typeof PackageOperationCallerSchema.Type

export const PackageOperationTargetSchema = Schema.Struct({
  source: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
  name: Schema.optionalKey(Schema.String),
})
export type PackageOperationTarget = typeof PackageOperationTargetSchema.Type

const receipt = {
  ...PackageMutationRequestSchema.fields,
  id: Schema.NonEmptyString,
  callerScope: Schema.NonEmptyString,
  createdAt: Schema.Number,
  targets: Schema.Array(PackageOperationTargetSchema),
}
export const PackageOperationReceiptSchema = Schema.Union([
  Schema.Struct({ ...receipt, outcome: Schema.Literals(['preparing', 'committed']) }),
  Schema.Struct({
    ...receipt,
    outcome: Schema.Literals(['failed', 'interrupted']),
    error: Schema.String,
  }),
])
export type PackageOperationReceipt = typeof PackageOperationReceiptSchema.Type
export const PackageOperationReceiptsSchema = Schema.Array(PackageOperationReceiptSchema)

export const PackageInventoryEntrySchema = Schema.Struct({
  source: Schema.String,
  kind: Schema.Literals(['npm', 'git', 'local']),
  name: Schema.optionalKey(Schema.String),
  revision: Schema.optionalKey(Schema.String),
})
export type PackageInventoryEntry = typeof PackageInventoryEntrySchema.Type
export const PackageInventorySchema = Schema.Array(PackageInventoryEntrySchema)
