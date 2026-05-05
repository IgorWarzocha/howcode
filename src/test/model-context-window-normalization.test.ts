import { describe, expect, it } from 'vitest'
import {
  normalizeModelContextWindow,
  normalizeModelContextWindowValue,
  normalizeModelRegistryContextWindows,
} from '../../shared/model-context-window-normalization'

describe('model context window normalization', () => {
  it('treats dot-formatted token windows as thousands-grouped values', () => {
    expect(normalizeModelContextWindowValue(202.752)).toBe(202_752)
    expect(normalizeModelContextWindowValue(8.192)).toBe(8_192)
  })

  it('keeps normal integer context windows unchanged', () => {
    expect(normalizeModelContextWindowValue(128_000)).toBe(128_000)
    expect(normalizeModelContextWindowValue(1_048_576)).toBe(1_048_576)
  })

  it('normalizes model context and output token limits', () => {
    expect(normalizeModelContextWindow({ contextWindow: 202.752, maxTokens: 8.192 })).toEqual({
      contextWindow: 202_752,
      maxTokens: 8_192,
    })
  })

  it('preserves synchronous getAvailable registries', () => {
    const registry = normalizeModelRegistryContextWindows({
      find: () => ({ id: 'glm', contextWindow: 202.752, maxTokens: 8.192 }),
      getAvailable: () => [{ id: 'glm', contextWindow: 202.752, maxTokens: 8.192 }],
    })

    const availableModels = registry.getAvailable()
    expect(Array.isArray(availableModels)).toBe(true)
    expect(availableModels).toEqual([{ id: 'glm', contextWindow: 202_752, maxTokens: 8_192 }])
    expect(registry.find()).toEqual({ id: 'glm', contextWindow: 202_752, maxTokens: 8_192 })
  })

  it('preserves async getAvailable registries', async () => {
    const registry = normalizeModelRegistryContextWindows({
      getAvailable: async () => [{ id: 'glm', contextWindow: 202.752, maxTokens: 8.192 }],
    })

    await expect(registry.getAvailable()).resolves.toEqual([
      { id: 'glm', contextWindow: 202_752, maxTokens: 8_192 },
    ])
  })
})
