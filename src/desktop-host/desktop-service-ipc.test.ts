import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { DesktopServiceMessageSchema } from '../../shared/desktop-service-ipc'

const decode = Schema.decodeUnknownResult(DesktopServiceMessageSchema)

describe('Desktop service IPC schema', () => {
  it.each([undefined, null, 42, 'invalid'])(
    'validates encoded interrupt fiber ID %s',
    (fiberId) => {
      const result = decode({
        type: 'terminal-rpc-response',
        message: {
          // biome-ignore lint/style/useNamingConvention: Effect RPC wire discriminator.
          _tag: 'Exit',
          requestId: '1',
          exit: {
            // biome-ignore lint/style/useNamingConvention: Effect RPC wire discriminator.
            _tag: 'Failure',
            cause: [
              {
                // biome-ignore lint/style/useNamingConvention: Effect RPC wire discriminator.
                _tag: 'Interrupt',
                fiberId,
              },
            ],
          },
        },
      })
      expect(Result.isSuccess(result)).toBe(fiberId !== 'invalid')
    },
  )

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
