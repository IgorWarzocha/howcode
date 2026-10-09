import * as Schema from 'effect/Schema'

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const DevRuntimeActivity = Schema.Struct({
  tasks: Count,
  blockedTasks: Count,
  submissions: Count,
  terminals: Count,
  requests: Count,
})
export interface DevRuntimeActivity extends Schema.Schema.Type<typeof DevRuntimeActivity> {}

/** Private service RPC; never exposed through renderer requests. */
export type DevRuntimeService = {
  inspectActivity: () => Promise<DevRuntimeActivity>
}

export const DevBridgeInspection = Schema.Struct({
  type: Schema.Literal('inspect-activity'),
  id: Schema.String,
})

export const DevBridgeMessage = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('ready'),
    port: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  }),
  Schema.Struct({
    type: Schema.Literal('activity'),
    id: Schema.String,
    activity: DevRuntimeActivity,
  }),
  Schema.Struct({
    type: Schema.Literal('activity-error'),
    id: Schema.String,
    error: Schema.String,
  }),
])

export function isDevRuntimeIdle(activity: DevRuntimeActivity) {
  return (
    activity.tasks === 0 &&
    activity.submissions === 0 &&
    activity.terminals === 0 &&
    activity.requests === 0
  )
}
