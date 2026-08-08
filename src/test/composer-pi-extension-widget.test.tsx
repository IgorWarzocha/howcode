import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PiExtensionWidgetLines } from '../app/composer/composer-pi-extension-widget'

describe('composer Pi extension widget rendering', () => {
  it('renders styled protocol segments without leaking markers', () => {
    const markup = renderToStaticMarkup(
      <PiExtensionWidgetLines
        widget={{
          key: 'test-widget',
          lines: [
            'plain \u001b]howcode-style;fg:error\u0007failed\u001b]howcode-style;reset\u0007',
          ],
        }}
      />,
    )

    expect(markup).toContain('plain ')
    expect(markup).toContain('failed')
    expect(markup).toContain('text-[color:var(--danger)]')
    expect(markup).not.toContain('howcode-style')
  })

  it('preserves extension-rendered boxes as one preformatted block', () => {
    const markup = renderToStaticMarkup(
      <PiExtensionWidgetLines
        widget={{ key: 'boxed-widget', lines: ['╭─ Status ─╮', '│ Ready │', '╰──────────╯'] }}
      />,
    )

    expect(markup.match(/<pre/g)).toHaveLength(1)
    expect(markup.replace(/<[^>]*>/gu, '')).toBe('╭─ Status ─╮\n│ Ready │\n╰──────────╯')
  })
})
