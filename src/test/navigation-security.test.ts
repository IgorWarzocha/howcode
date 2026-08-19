import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  isTrustedRendererUrl,
  shouldOpenUrlExternally,
} from '../electron/main/app/navigation-security'

const rendererDistDirectory = path.join(process.cwd(), 'dist')

describe('navigation security helpers', () => {
  it('rejects other packaged file urls', () => {
    expect(
      isTrustedRendererUrl(
        pathToFileURL(path.join(rendererDistDirectory, 'assets', 'index.js')).toString(),
        {
          rendererDistDirectory,
        },
      ),
    ).toBe(false)
  })

  it('rejects different dev server origins', () => {
    expect(
      isTrustedRendererUrl('https://example.com', {
        rendererDistDirectory,
        devServerUrl: 'http://127.0.0.1:5173/',
      }),
    ).toBe(false)
  })

  it('rejects unsafe external protocols', () => {
    expect(shouldOpenUrlExternally('file:///tmp/evil.html')).toBe(false)
    expect(shouldOpenUrlExternally('javascript:alert(1)')).toBe(false)
  })
})
