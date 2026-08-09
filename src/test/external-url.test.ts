import { describe, expect, it } from 'vitest'

import { getSafeExternalUrl, isSafeExternalUrl } from '../../shared/external-url'

describe('external URL safety', () => {
  it('strips git+ prefixes before returning the URL to open', () => {
    expect(getSafeExternalUrl('git+https://example.com/repo.git')).toBe(
      'https://example.com/repo.git',
    )
  })

  it('rejects non-web schemes', () => {
    expect(getSafeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(getSafeExternalUrl('git+ssh://example.com/repo.git')).toBeNull()
    expect(isSafeExternalUrl('file:///tmp/readme.md')).toBe(false)
  })
})
