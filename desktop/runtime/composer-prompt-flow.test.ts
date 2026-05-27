import { afterEach, describe, expect, it, vi } from 'vitest'
import { promptAndReturnAfterPreflight } from './composer-preflight.ts'
import {
  buildComposerPromptMessage,
  compactComposerRuntime,
  isExtensionCommandPrompt,
} from './composer-prompt-flow.ts'
import type { PiRuntime } from './types.ts'

afterEach(() => {
  vi.useRealTimers()
})

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

  it('returns once an extension command is observed as running', async () => {
    let commandRunning = false
    const runtime = {
      session: {
        sessionFile: '/tmp/session.jsonl',
        prompt: async () => {
          commandRunning = true
          await new Promise(() => {
            // Intentionally never resolves; this simulates a still-running runtime command.
          })
        },
      },
    } as unknown as PiRuntime

    await expect(
      promptAndReturnAfterPreflight({
        acceptWhen: () => commandRunning,
        emitComposerUpdate: async () => {
          // No-op for this focused prompt flow test.
        },
        message: '/review',
        request: { sessionPath: '/tmp/session.jsonl' },
        runtime,
        scheduleRuntimeDisposal: () => {
          // No-op for this focused prompt flow test.
        },
      }),
    ).resolves.toBeUndefined()
  })

  it('returns from compact once the runtime reports compaction started', async () => {
    vi.useFakeTimers()
    const publishThreadUpdate = vi.fn(async () => undefined)
    const emitComposerUpdate = vi.fn(async () => undefined)
    const runtime = {
      cwd: '/tmp/project',
      session: {
        sessionFile: '/tmp/session.jsonl',
        sessionId: 'thread-1',
        isStreaming: false,
        isCompacting: false,
        compact: vi.fn(async function (this: { isCompacting: boolean }) {
          setTimeout(() => {
            this.isCompacting = true
          }, 50)
          await new Promise(() => {
            // Compaction keeps running; the action should not hold the composer lock forever.
          })
        }),
        sessionManager: {
          getBranch: () => [{ type: 'message' }, { type: 'message' }],
        },
      },
    } as unknown as PiRuntime

    const resultPromise = compactComposerRuntime({
      adapters: {
        emitComposerUpdate,
        isRuntimeExtensionCommandRunning: () => false,
        publishThreadUpdate,
        scheduleRuntimeDisposal: () => undefined,
      },
      compactInstructions: '',
      persistedSessionPath: '/tmp/session.jsonl',
      request: { sessionPath: '/tmp/session.jsonl' },
      runtime,
    })

    vi.advanceTimersByTime(50)
    await Promise.resolve()

    await expect(resultPromise).resolves.toEqual({
      outcome: 'sent',
      sessionPath: '/tmp/session.jsonl',
      threadId: 'thread-1',
    })
    expect(publishThreadUpdate).not.toHaveBeenCalled()
    expect(emitComposerUpdate).not.toHaveBeenCalled()
  })
})
