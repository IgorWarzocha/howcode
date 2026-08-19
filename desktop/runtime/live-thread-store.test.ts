import { describe, expect, it } from 'vitest'
import { markInternalThreadUpdate, shouldSuppressExternalThreadUpdate } from './live-thread-store'

describe('live thread update suppression', () => {
  it('retains an epoch timestamp instead of treating it as absent', () => {
    const sessionPath = '/tmp/howcode-epoch-session.jsonl'
    markInternalThreadUpdate(sessionPath, 0)

    expect(shouldSuppressExternalThreadUpdate(sessionPath, 100)).toBe(true)
  })
})
