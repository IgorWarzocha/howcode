import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ThreadMessage } from '../app/common/thread-message'

describe('thread message rendering', () => {
  it('preserves markdown rendering for user and assistant prose', () => {
    const userMarkup = renderToStaticMarkup(
      <ThreadMessage
        message={{ id: 'user', role: 'user', content: ['**bold user**', '**bold user**'] }}
      />,
    )
    const assistantMarkup = renderToStaticMarkup(
      <ThreadMessage
        message={{
          id: 'assistant',
          role: 'assistant',
          content: ['[Howcode](https://howcode.dev)'],
        }}
      />,
    )

    expect(userMarkup.match(/<strong/g)).toHaveLength(2)
    expect(userMarkup).toContain('bold user')
    expect(assistantMarkup).toContain('<a')
    expect(assistantMarkup).toContain('https://howcode.dev')
  })
})
