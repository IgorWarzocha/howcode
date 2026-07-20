import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { RuntimeHostToMainMessageSchema } from './protocol.ts'

const decode = Schema.decodeUnknownResult(RuntimeHostToMainMessageSchema)

describe('Runtime-host IPC schema', () => {
  it('decodes valid response and event messages', () => {
    expect(
      Result.isSuccess(
        decode({ type: 'response', id: 'request-1', ok: true, result: { ok: true } }),
      ),
    ).toBe(true)
    expect(
      Result.isSuccess(
        decode({
          type: 'desktop-event',
          event: { type: 'session-tree-refresh', sessionPath: '/thread.jsonl' },
        }),
      ),
    ).toBe(true)
  })

  it('rejects malformed and unknown messages', () => {
    expect(Result.isFailure(decode({ type: 'response', id: 1, ok: true }))).toBe(true)
    expect(
      Result.isFailure(
        decode({ type: 'main-request', id: '1', name: 'unknown-operation', payload: {} }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(decode({ type: 'desktop-event', event: { type: 'session-tree-refresh' } })),
    ).toBe(true)
  })
})
