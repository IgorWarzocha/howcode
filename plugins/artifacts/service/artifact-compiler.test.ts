import { describe, expect, it } from 'vitest'
import { compileReactArtifact } from './artifact-compiler.ts'

describe('compileReactArtifact', () => {
  it('rejects artifact imports outside the preview allowlist', async () => {
    const result = await compileReactArtifact(`
      import fs from 'node:fs'
      export default function Artifact() {
        return <main>{String(fs)}</main>
      }
    `)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('React artifacts cannot import')
    }
  })
})
