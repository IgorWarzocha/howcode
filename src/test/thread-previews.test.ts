import { describe, expect, it } from 'vitest'
import { getThinkingPreview } from '../app/utils/thread-previews'

describe('thread previews', () => {
  it('does not leak raw reasoning into the thinking disclosure preview', () => {
    expect(
      getThinkingPreview([
        'Oh! The user is talking about the token count/context pie chart element.',
      ]),
    ).toBeNull()
  })

  it('keeps empty and redacted thinking states explicit', () => {
    expect(getThinkingPreview([])).toBe('No reasoning captured')
    expect(getThinkingPreview([], true)).toBe('Reasoning unavailable')
  })
})
