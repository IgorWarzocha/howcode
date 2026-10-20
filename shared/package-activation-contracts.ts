import * as Schema from 'effect/Schema'

export const PackageActivationStageSchema = Schema.Literals(['service', 'renderer'])
export type PackageActivationStage = typeof PackageActivationStageSchema.Type

export const PackageActivationOutcomeSchema = Schema.Struct({
  operationId: Schema.String,
  stage: PackageActivationStageSchema,
  status: Schema.Literals(['pending', 'ready', 'failed', 'removed', 'superseded']),
  reason: Schema.optional(Schema.String),
})
export type PackageActivationOutcome = typeof PackageActivationOutcomeSchema.Type

/** Source-owned subscription state. Native receipts remain the delivery authority. */
export const PackageActivationSubscriptionSchema = Schema.Struct({
  id: Schema.String,
  operationId: Schema.String,
  stage: PackageActivationStageSchema,
  conversationId: Schema.String,
  acceptedTaskId: Schema.String,
  createdAt: Schema.Number,
  outcome: Schema.optional(PackageActivationOutcomeSchema),
  delivery: Schema.Union([
    Schema.Struct({ status: Schema.Literal('pending'), error: Schema.optional(Schema.String) }),
    Schema.Struct({ status: Schema.Literal('accepted'), submissionId: Schema.String }),
    Schema.Struct({
      status: Schema.Literal('unanswered'),
      submissionId: Schema.String,
      reason: Schema.String,
    }),
  ]),
})
export type PackageActivationSubscription = typeof PackageActivationSubscriptionSchema.Type
