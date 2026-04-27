export async function mapWithConcurrency<TInput, TOutput>(
  inputs: TInput[],
  concurrency: number,
  mapper: (input: TInput) => Promise<TOutput>,
) {
  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;

  const workerCount = Math.min(concurrency, inputs.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < inputs.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(inputs[currentIndex] as TInput);
      }
    }),
  );

  return results;
}
