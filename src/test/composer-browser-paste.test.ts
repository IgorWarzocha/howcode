import { describe, expect, it } from 'vitest'
import {
  getComposerAttachmentsFromClipboardData,
  getPreferredClipboardTextFromClipboardData,
} from '../app/composer/composer-paste-attachments'

function transfer(values: Record<string, string>) {
  return { getData: (type: string) => values[type] ?? '', types: Object.keys(values) }
}

describe('browser transfer attachment policy', () => {
  it('never turns client file paths or unsafe URI schemes into server attachments', () => {
    for (const value of ['/tmp/photo.png', 'file:///tmp/photo.png', 'javascript:alert(1)']) {
      expect(getComposerAttachmentsFromClipboardData(transfer({ 'text/uri-list': value }))).toEqual(
        [],
      )
    }
    expect(
      getComposerAttachmentsFromClipboardData({
        ...transfer({}),
        files: [{ path: '/tmp/photo.png', name: 'photo.png' }],
      }),
    ).toEqual([])
  })

  it('keeps safe external links and deduplicates repeated transfer formats', () => {
    const attachments = getComposerAttachmentsFromClipboardData(
      transfer({
        'text/uri-list': 'https://example.com/photo.png',
        'text/plain': 'https://example.com/photo.png',
      }),
    )
    expect(attachments.map((attachment) => attachment.path)).toEqual([
      'https://example.com/photo.png',
    ])
  })

  it('preserves plain text whitespace without treating local paths as file access', () => {
    const source = transfer({ 'text/plain': '  /tmp/photo.png\n' })
    expect(getComposerAttachmentsFromClipboardData(source)).toEqual([])
    expect(getPreferredClipboardTextFromClipboardData(source)).toBe('  /tmp/photo.png\n')
  })
})
