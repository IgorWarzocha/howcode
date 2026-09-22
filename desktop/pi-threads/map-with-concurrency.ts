import * as Effect from 'effect/Effect'

export async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Concurrency must be a positive integer.')
  }
  return Effect.runPromise(
    Effect.forEach(
      inputs,
      (input) =>
        Effect.tryPromise({ try: () => mapper(input), catch: (error) => error }).pipe(
          // Admitted filesystem/DB operations must finish before their caller returns.
          Effect.uninterruptible,
        ),
      { concurrency },
    ),
  )
}
