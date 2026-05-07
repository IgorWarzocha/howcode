import { describe, expect, it } from 'vitest'
import { buildHtmlPreview, buildReactPreview } from './artifactPreviewBuilders'

describe('artifact preview builders', () => {
  it('wraps HTML fragments in a complete preview document', () => {
    const preview = buildHtmlPreview('<h1>Hello</h1>')

    expect(preview).toContain('<!doctype html>')
    expect(preview).toContain('<h1>Hello</h1>')
    expect(preview).toContain('howcode-artifact-preview')
  })

  it('injects preview diagnostics into uppercase HTML heads', () => {
    const preview = buildHtmlPreview('<!doctype html><HTML><HEAD></HEAD><BODY>Hi</BODY></HTML>')

    expect(preview).toContain('<head>')
    expect(preview).toContain('howcode-artifact-preview')
    expect(preview.indexOf('howcode-artifact-preview')).toBeGreaterThan(preview.indexOf('<head>'))
  })

  it('escapes script endings in React bundles', () => {
    const preview = buildReactPreview('console.log("</script>")')

    expect(preview).toContain('<\\/script>')
  })
})
