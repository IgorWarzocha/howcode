import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { RegistrySearchResponse } from '../../desktop/pi-packages/registry-schema'
import { decodeSessionFileLine } from '../../desktop/pi-threads/session-entry-schema'
import { SkillDownloadApiResponse } from '../../desktop/skills/api-schema'
import { decodePersistedRow, ThreadRowSchema } from '../../desktop/thread-state-db/row-schema'
import { ComposerStateSchema, PiExtensionUiStateSchema } from '../../shared/desktop-composer-schema'
import {
  DevWebDesktopEventEnvelope,
  DevWebTerminalEventEnvelope,
} from '../app/dev-web-event-schema'
import {
  ComposerAttachmentUploadResponseSchema,
  HeadlessAuthStateSchema,
} from '../app/dev-web-response-schema'

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

  it('rejects malformed composer and headless response payloads', () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(PiExtensionUiStateSchema)({
          piExtensionWidgets: {},
          piExtensionStatuses: [],
          piExtensionDialogRequest: null,
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(Schema.decodeUnknownResult(ComposerStateSchema)({ isCompacting: false })),
    ).toBe(true)
    expect(
      Result.isFailure(Schema.decodeUnknownResult(HeadlessAuthStateSchema)({ required: 'yes' })),
    ).toBe(true)
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(ComposerAttachmentUploadResponseSchema)({
          attachments: [{ path: '/tmp/x', name: 'x', kind: 'unknown' }],
        }),
      ),
    ).toBe(true)
  })

  it('rejects malformed persisted session entries', () => {
    expect(decodeSessionFileLine('{"type":"session_info","name":42}')).toBeNull()
  })

  it('rejects malformed persisted database rows', () => {
    expect(() => decodePersistedRow(ThreadRowSchema, { id: 42 }, 'thread')).toThrow(
      'Invalid persisted thread row',
    )
  })
})
