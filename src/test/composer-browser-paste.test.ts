import { describe, expect, it } from 'vitest'
import { getComposerAttachmentsFromClipboardData } from '../app/composer/composer-paste-attachments'

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
})
