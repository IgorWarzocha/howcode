import { describe, expect, it } from 'vitest'
import {
  clearRuntimeToolProgress,
  getLiveToolProgressMessages,
  rememberRuntimeToolProgress,
} from './live-tool-progress-store'

describe('live tool progress store', () => {
  it('builds deterministic fallback messages for running and terminal tool calls', () => {
    const runtime = {} as never

    rememberRuntimeToolProgress(runtime, { toolCallId: 'a', toolName: 'grep' })
    expect(getLiveToolProgressMessages(runtime)).toMatchObject([
      {
        role: 'toolResult',
        toolCallId: 'a',
        toolName: 'grep',
        running: true,
        content: [{ type: 'text', text: 'Running grep...' }],
      },
    ])

    rememberRuntimeToolProgress(runtime, {
      toolCallId: 'a',
      toolName: 'grep',
      isError: true,
      terminal: true,
    })
    expect(getLiveToolProgressMessages(runtime)).toMatchObject([
      {
        toolCallId: 'a',
        running: false,
        isError: true,
        content: [{ type: 'text', text: 'grep failed.' }],
      },
    ])
  })

  it('preserves displayable partial content and supports targeted cleanup', () => {
    const runtime = {} as never

    rememberRuntimeToolProgress(runtime, {
      toolCallId: 'image',
      toolName: 'screenshot',
      partialResult: { content: [{ type: 'image', data: 'base64' }] },
    })
    rememberRuntimeToolProgress(runtime, {
      toolCallId: 'text',
      toolName: 'grep',
      partialResult: { content: 'found it' },
    })

    expect(getLiveToolProgressMessages(runtime)).toMatchObject([
      { content: [{ type: 'image', data: 'base64' }] },
      { content: 'found it' },
    ])

    clearRuntimeToolProgress(runtime, { toolName: 'screenshot' })
    expect(getLiveToolProgressMessages(runtime)).toMatchObject([{ toolCallId: 'text' }])

    clearRuntimeToolProgress(runtime)
    expect(getLiveToolProgressMessages(runtime)).toEqual([])
  })
})
