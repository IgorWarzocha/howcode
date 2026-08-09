import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { decodeRuntimeHostResponse } from './response-schema.ts'
import { RuntimeHostToMainMessageSchema } from './runtime-host-ipc-schema.ts'

const decode = Schema.decodeUnknownResult(RuntimeHostToMainMessageSchema)

describe('Runtime-host IPC schema', () => {
  it('rejects malformed and unknown messages', () => {
    expect(Result.isFailure(decode({ type: 'response', id: 1, ok: true }))).toBe(true)
    expect(
      Result.isFailure(decode({ type: 'desktop-event', event: { type: 'session-tree-refresh' } })),
    ).toBe(true)
  })

  it('rejects a malformed result for its request channel', () => {
    expect(() => decodeRuntimeHostResponse('getComposerState', { isCompacting: false })).toThrow(
      'Invalid getComposerState runtime-host response',
    )
  })
})
