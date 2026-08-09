import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { TerminalOpenRequest } from '../../shared/terminal-contracts.ts'

describe('terminal RPC schema', () => {
  it('rejects malformed terminal input', async () => {
    const result = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(TerminalOpenRequest)({
        projectId: '/workspace/project',
        cols: 0,
        rows: 40,
      }),
    )

    expect(result._tag).toBe('Failure')
  })
})
