import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { RegistrySearchResponse } from '../../desktop/pi-packages/registry-schema'
import { SkillDownloadApiResponse } from '../../desktop/skills/api-schema'
import {
  DevWebDesktopEventEnvelope,
  DevWebTerminalEventEnvelope,
} from '../app/dev-web-event-schema'

describe('external payload schemas', () => {
  it('rejects malformed catalog collections', () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(RegistrySearchResponse)({ objects: [null], total: 1 }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(SkillDownloadApiResponse)({ files: 'not-an-array' }),
      ),
    ).toBe(true)
  })

  it('rejects mismatched or malformed dev-web events', () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(DevWebDesktopEventEnvelope)({
          channel: 'terminalEvent',
          event: { type: 'shell-state-refresh' },
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(DevWebTerminalEventEnvelope)({
          channel: 'terminalEvent',
          event: { type: 'output', sessionId: '', createdAt: 'now', data: 'hello' },
        }),
      ),
    ).toBe(true)
  })
})
