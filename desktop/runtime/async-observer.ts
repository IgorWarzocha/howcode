import type * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'

function readCondition(condition: () => boolean) {
  return Effect.sync(() => {
    try {
      return condition()
    } catch {
      return false
    }
  })
}

export function waitForCondition(condition: () => boolean, interval: Duration.Input) {
  return readCondition(condition).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(interval),
      until: (ready) => ready,
    }),
    Effect.asVoid,
  )
}

export function waitForConditionOrSettlement(
  condition: () => boolean,
  settlement: PromiseLike<unknown>,
  interval: Duration.Input,
) {
  const conditionObserved = waitForCondition(condition, interval).pipe(
    Effect.as('condition' as const),
  )
  const settled = Effect.tryPromise({
    try: async () => await settlement,
    catch: (error) => error,
  }).pipe(Effect.as('settled' as const))
  return Effect.raceFirst(conditionObserved, settled)
}
