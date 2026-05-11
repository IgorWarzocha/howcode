import { describe, expect, it } from 'vitest'
import {
  getFirstUserTurnTitle,
  getPreviousMessageCount,
  mapAgentMessagesToUiMessages,
  normalizeThreadTitle,
} from '../../shared/pi-message-mapper'
import { buildSourceMessagesFromPathEntries } from '../../shared/thread-history'

describe('pi message mapper', () => {
  it('normalizes titles and derives the first user title', () => {
    expect(normalizeThreadTitle('')).toBe('New thread')
    expect(normalizeThreadTitle('   hello\n\nworld   ')).toBe('hello world')
    expect(normalizeThreadTitle('x'.repeat(80))).toBe(`${'x'.repeat(69)}...`)

    const messages = mapAgentMessagesToUiMessages([
      { role: 'assistant', timestamp: 1, content: [{ type: 'text', text: 'Preface' }] },
      { role: 'user', timestamp: 2, content: [{ type: 'text', text: 'Fix the sidebar' }] },
    ] as never[])
    expect(getFirstUserTurnTitle(messages)).toBe('Fix the sidebar')
  })

  it('maps mixed runtime messages into desktop messages', () => {
    const messages = mapAgentMessagesToUiMessages([
      {
        role: 'user',
        timestamp: 1,
        content: [
          { type: 'text', text: 'Investigate this bug' },
          { type: 'image', mimeType: 'image/png' },
        ],
      },
      {
        role: 'assistant',
        timestamp: 2,
        content: [
          { type: 'thinking', thinking: 'Need to inspect the state flow first' },
          { type: 'text', text: 'First paragraph\n\nSecond paragraph' },
        ],
      },
      {
        role: 'toolResult',
        timestamp: 3,
        toolName: 'grep',
        isError: false,
        content: [{ type: 'text', text: 'Found 2 matches' }],
      },
      {
        role: 'bashExecution',
        timestamp: 4,
        command: 'npm test',
        output: 'line1\n\nline2',
        exitCode: 0,
      },
      {
        role: 'branchSummary',
        timestamp: 5,
        summary: 'Kept the main branch summary',
      },
    ] as never[])

    expect(messages).toEqual([
      {
        id: '1-user',
        role: 'user',
        content: ['Investigate this bug', 'Attached image 1'],
      },
      {
        id: '2-assistant',
        role: 'assistant',
        content: ['First paragraph\n\nSecond paragraph'],
        thinkingContent: ['Need to inspect the state flow first'],
      },
      {
        id: '3-toolResult',
        role: 'toolResult',
        toolName: 'grep',
        content: ['Found 2 matches'],
        isError: false,
      },
      {
        id: '4-bashExecution',
        role: 'bashExecution',
        command: 'npm test',
        output: ['line1', 'line2'],
        exitCode: 0,
        cancelled: false,
        truncated: false,
      },
      {
        id: '5-branchSummary',
        role: 'branchSummary',
        content: ['Kept the main branch summary'],
      },
    ])
  })

  it('keeps assistant markdown as complete documents', () => {
    const markdown = [
      'Validation',
      [
        '```sh',
        'bunx biome check src/app/components/common/markdown-content.tsx \\',
        '  shared/pi-message-mapper.ts',
        '```',
      ].join('\n'),
      'No tests run.',
    ].join('\n\n')

    const messages = mapAgentMessagesToUiMessages([
      {
        role: 'assistant',
        timestamp: 1,
        content: [{ type: 'text', text: markdown }],
      },
    ] as never[])

    expect(messages).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: [markdown],
      },
    ])
  })

  it('marks errored assistant messages for desktop styling', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [],
          stopReason: 'error',
          errorMessage: 'Provider request failed',
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: ['Provider request failed'],
        isError: true,
        stopReason: 'error',
      },
    ])
  })

  it('keeps aborted assistant messages distinct from errors', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [],
          stopReason: 'aborted',
          errorMessage: 'Request was aborted.',
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: ['Request was aborted.'],
        stopReason: 'aborted',
      },
    ])
  })

  it('preserves assistant stop reasons that affect desktop display', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [{ type: 'text', text: 'Partial answer' }],
          stopReason: 'length',
        },
        {
          role: 'assistant',
          timestamp: 2,
          content: [{ type: 'text', text: 'Cancelled answer' }],
          stopReason: 'aborted',
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: ['Partial answer'],
        stopReason: 'length',
      },
      {
        id: '2-assistant',
        role: 'assistant',
        content: ['Cancelled answer'],
        stopReason: 'aborted',
      },
    ])
  })

  it('preserves assistant usage summaries for lazy composer details', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [{ type: 'text', text: 'Done' }],
          usage: {
            input: 100,
            output: 25,
            cacheRead: 40,
            cacheWrite: 10,
            totalTokens: 175,
            cost: { total: 0.0123 },
          },
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: ['Done'],
        usage: {
          input: 100,
          output: 25,
          cacheRead: 40,
          cacheWrite: 10,
          totalTokens: 175,
          costTotal: 0.0123,
        },
      },
    ])
  })

  it('preserves tool result images for desktop rendering', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'toolResult',
          timestamp: 1,
          toolName: 'custom_image_tool',
          isError: false,
          content: [
            { type: 'text', text: 'Generated image' },
            { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
          ],
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-toolResult',
        role: 'toolResult',
        toolName: 'custom_image_tool',
        content: ['Generated image', 'Attached image 1'],
        images: [
          {
            src: 'data:image/png;base64,iVBORw0KGgo=',
            mimeType: 'image/png',
            alt: 'Tool result image 2',
          },
        ],
        isError: false,
      },
    ])
  })

  it('preserves live tool progress arguments and running state', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'toolResult',
          timestamp: 'tool-progress:abc',
          toolCallId: 'abc-call',
          toolName: 'read',
          isError: false,
          running: true,
          args: { path: 'src/app.tsx' },
          content: [{ type: 'text', text: 'Running read...' }],
        },
      ] as never[]),
    ).toEqual([
      {
        id: 'tool-progress:abc-toolResult',
        role: 'toolResult',
        toolCallId: 'abc-call',
        toolName: 'read',
        content: ['Running read...'],
        isError: false,
        args: '{\n  "path": "src/app.tsx"\n}',
        running: true,
      },
    ])
  })

  it('truncates large live tool progress arguments', () => {
    const [message] = mapAgentMessagesToUiMessages([
      {
        role: 'toolResult',
        timestamp: 'tool-progress:large',
        toolName: 'write',
        isError: false,
        running: true,
        args: { content: 'x'.repeat(5000) },
        content: [{ type: 'text', text: 'Running write...' }],
      },
    ] as never[])

    expect(message?.role).toBe('toolResult')
    if (message?.role !== 'toolResult') return
    expect(message.args?.length).toBeLessThan(4100)
    expect(message.args).toContain('… truncated')
  })

  it('preserves displayed extension and system messages', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'custom',
          timestamp: 1,
          customType: 'review-extension',
          content: 'Review queued\n\nWaiting for Codex',
        },
        {
          role: 'system',
          timestamp: 2,
          content: [{ type: 'text', text: 'Extension loaded' }],
        },
        {
          role: 'extensionNotice',
          timestamp: 3,
          content: [{ type: 'text', text: 'A non-standard Pi message' }],
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-custom',
        role: 'custom',
        customType: 'review-extension',
        content: ['Review queued', 'Waiting for Codex'],
      },
      {
        id: '2-system',
        role: 'system',
        label: 'System',
        content: ['Extension loaded'],
      },
      {
        id: '3-extensionNotice',
        role: 'system',
        label: 'extensionNotice',
        content: ['A non-standard Pi message'],
      },
    ])
  })

  it('marks Howcode extension error messages for desktop styling', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'custom',
          timestamp: 1,
          customType: 'howcode.extension.error',
          content: 'Test extension error: boom',
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-custom',
        role: 'custom',
        customType: 'howcode.extension.error',
        content: ['Test extension error: boom'],
        isError: true,
      },
    ])
  })

  it('surfaces model and thinking changes as muted system messages', () => {
    const messages = buildSourceMessagesFromPathEntries([
      {
        type: 'model_change',
        id: 'model-1',
        timestamp: 1,
        provider: 'openai',
        modelId: 'gpt-5',
      },
      {
        type: 'thinking_level_change',
        id: 'thinking-1',
        timestamp: 2,
        thinkingLevel: 'high',
      },
    ])

    expect(mapAgentMessagesToUiMessages(messages)).toEqual([
      {
        id: '1-system',
        role: 'system',
        label: 'Model changed',
        content: ['openai/gpt-5/high'],
      },
    ])
  })

  it('surfaces standalone thinking changes as reasoning messages', () => {
    const messages = buildSourceMessagesFromPathEntries([
      {
        type: 'thinking_level_change',
        id: 'thinking-1',
        timestamp: 1,
        thinkingLevel: 'medium',
      },
    ])

    expect(mapAgentMessagesToUiMessages(messages)).toEqual([
      {
        id: '1-system',
        role: 'system',
        label: 'Reasoning changed',
        content: ['medium'],
      },
    ])
  })

  it('preserves thinking-only messages and extracts thinking headers', () => {
    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [{ type: 'thinking', thinking: 'Working through the repo structure' }],
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: [],
        thinkingContent: ['Working through the repo structure'],
      },
    ])

    expect(
      mapAgentMessagesToUiMessages([
        {
          role: 'assistant',
          timestamp: 1,
          content: [
            {
              type: 'thinking',
              thinking:
                '**Optimizing Markdown Formatting**\n\nBody\n\n## Formatting thoughts and styles\n\nMore body\n\n__Considering markdown in thinking blocks__\n\nLast body',
            },
          ],
        },
      ] as never[]),
    ).toEqual([
      {
        id: '1-assistant',
        role: 'assistant',
        content: [],
        thinkingContent: [
          '**Optimizing Markdown Formatting**',
          'Body',
          '## Formatting thoughts and styles',
          'More body',
          '__Considering markdown in thinking blocks__',
          'Last body',
        ],
        thinkingHeaders: [
          'Optimizing Markdown Formatting',
          'Formatting thoughts and styles',
          'Considering markdown in thinking blocks',
        ],
      },
    ])
  })

  it('counts previous messages from the latest compaction boundary', () => {
    expect(
      getPreviousMessageCount([
        { type: 'message', id: 'm1' },
        { type: 'custom_message', id: 'm2' },
        { type: 'branch_summary', id: 'm3' },
        { type: 'message', id: 'keep' },
        { type: 'compaction', id: 'c1', firstKeptEntryId: 'keep' },
        { type: 'message', id: 'm4' },
      ]),
    ).toBe(3)
  })
})
