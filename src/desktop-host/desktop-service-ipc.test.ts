import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { DesktopServiceMessageSchema } from '../../shared/desktop-service-ipc'

const decode = Schema.decodeUnknownResult(DesktopServiceMessageSchema)

describe('Desktop service IPC schema', () => {
  it('rejects malformed terminal RPC envelopes', () => {
    expect(
      Result.isFailure(
        decode({
          type: 'terminal-rpc-response',
          message: {
            // biome-ignore lint/style/useNamingConvention: Effect RPC wire discriminator.
            _tag: 'Chunk',
            requestId: '1',
            values: [],
          },
        }),
      ),
    ).toBe(true)
  })
})
