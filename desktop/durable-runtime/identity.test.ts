import { describe, expect, it } from 'vitest'
import { decodeConversationId, decodeEntryId, decodeSubmissionId } from './identity.ts'

describe('Durable wire identity boundary', () => {
  it.each([
    '',
    '0',
    '-1',
    '1.0',
    '1e3',
    '+1',
    '01',
    ' 1',
    '1 ',
    'NaN',
    'Infinity',
    '9007199254740992',
    '/tmp/session.jsonl',
    'local:project',
  ])('rejects ambiguous or non-allocated identity %j', (value) => {
    for (const decode of [decodeConversationId, decodeEntryId, decodeSubmissionId])
      expect(() => decode(value)).toThrow('Invalid Durable identity')
  })
  it.each(['1', '1234', '9007199254740991'])('preserves exact allocation %s', (value) => {
    for (const decode of [decodeConversationId, decodeEntryId, decodeSubmissionId])
      expect(String(decode(value))).toBe(value)
  })
})
