import { describe, expect, it } from 'vitest'
import { compileReactArtifact } from './artifact-compiler.ts'

describe('compileReactArtifact', () => {
  it('pins React and ReactDOM imports to the preview runtime copy', async () => {
    const result = await compileReactArtifact(`
      import { useState } from 'react'

      export default function Artifact() {
        const [count, setCount] = useState(0)
        return <button onClick={() => setCount(count + 1)}>{count}</button>
      }
    `)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.js.match(/var require_react =/g)).toHaveLength(1)
      expect(result.js.match(/var require_react_dom_client/g)).toHaveLength(1)
    }
  })

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
