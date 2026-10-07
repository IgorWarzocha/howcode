import { expect, it } from 'vitest'
import { mapWithConcurrency } from './map-with-concurrency.ts'

it('bounds admitted work and preserves input order despite out-of-order completion', async () => {
  const gates = Array.from({ length: 4 }, () => Promise.withResolvers<number>())
  const started: number[] = []
  const mapping = mapWithConcurrency([0, 1, 2, 3], 2, async (index) => {
    started.push(index)
    const gate = gates[index]
    if (!gate) throw new Error('Missing test gate.')
    return gate.promise
  })
  try {
    expect(started).toEqual([0, 1])
    gates[1]?.resolve(10)
    await expect.poll(() => started).toEqual([0, 1, 2])
    gates[0]?.resolve(0)
    await expect.poll(() => started).toEqual([0, 1, 2, 3])
    gates[3]?.resolve(30)
    gates[2]?.resolve(20)
    await expect(mapping).resolves.toEqual([0, 10, 20, 30])
  } finally {
    gates.forEach((gate, index) => {
      gate.resolve(index)
    })
    await mapping
  }
})

it('rejects an invalid concurrency bound before running work', async () => {
  let ran = false
  await expect(
    mapWithConcurrency([1], 0, async () => {
      ran = true
    }),
  ).rejects.toThrow(RangeError)
  expect(ran).toBe(false)
})
