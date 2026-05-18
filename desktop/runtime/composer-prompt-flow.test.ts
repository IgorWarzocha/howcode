import { describe, expect, it } from 'vitest'
import { buildComposerPromptMessage, isExtensionCommandPrompt } from './composer-prompt-flow.ts'
import type { PiRuntime } from './types.ts'

describe('composer prompt flow', () => {
  it('prefixes attachment prompt before user text', () => {
    const message = buildComposerPromptMessage({
      attachments: [
        {
          kind: 'text',
          path: '/tmp/example.ts',
          name: 'example.ts',
        },
      ],
      text: 'Review this file.',
    })

    expect(message).toContain('Review this file.')
    expect(message).toContain('/tmp/example.ts')
    expect(message.indexOf('/tmp/example.ts')).toBeLessThan(message.indexOf('Review this file.'))
  })

  it('leaves plain prompts unchanged when there are no attachments', () => {
    expect(buildComposerPromptMessage({ text: 'hello' })).toBe('hello')
  })

  it('detects runtime extension command prompts by command name', () => {
    const runtime = {
      session: {
        extensionRunner: {
          getCommand: (name: string) => (name === 'review' ? {} : null),
        },
      },
    } as PiRuntime

    expect(isExtensionCommandPrompt(runtime, '/review these changes')).toBe(true)
    expect(isExtensionCommandPrompt(runtime, '/unknown')).toBe(false)
    expect(isExtensionCommandPrompt(runtime, 'not a command')).toBe(false)
  })
})
