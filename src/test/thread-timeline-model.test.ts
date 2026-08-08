import type { Message } from '@howcode/shared/desktop-contracts'
import { describe, expect, it } from 'vitest'
import { getParagraphRenderItems } from '../app/common/thread-message-utils'
import { buildTimelineRows } from '../app/thread/buildTimelineRows'
import { buildThreadTimelineState } from '../app/thread/thread-timeline-state'

function user(id: string, content = id): Message {
  return { id, role: 'user', content: [content] }
}

function assistant(id: string, content = id, thinkingContent?: string[]): Message {
  return { id, role: 'assistant', content: [content], thinkingContent }
}

function tool(id: string, toolCallId: string): Message {
  return {
    id,
    role: 'toolResult',
    toolCallId,
    toolName: 'read',
    content: [id],
    isError: false,
  }
}

describe('thread timeline row model', () => {
  it('gives repeated paragraphs stable occurrence keys', () => {
    expect(getParagraphRenderItems(['same', 'same'])).toEqual([
      { key: 'same:0', paragraph: 'same' },
      { key: 'same:1', paragraph: 'same' },
    ])
  })

  it('groups each user turn and adjacent tool calls without losing history metadata', () => {
    const rows = buildTimelineRows({
      previousMessageCount: 7,
      messages: [
        user('u1'),
        assistant('a1'),
        tool('t1', 'call-1'),
        tool('t2', 'call-2'),
        user('u2'),
      ],
    })

    expect(rows[0]).toEqual({
      kind: 'history-divider',
      id: 'history-divider:7',
      hiddenCount: 7,
    })
    expect(rows[1]).toMatchObject({
      kind: 'turn',
      id: 'turn:u1',
      userMessage: { id: 'u1' },
      items: [
        { kind: 'message', id: 'a1' },
        { kind: 'tool-group', messages: [{ id: 't1' }, { id: 't2' }] },
      ],
    })
    expect(rows[2]).toMatchObject({ kind: 'turn', id: 'turn:u2', items: [] })
  })

  it('keeps summaries standalone and starts a stable implicit turn after compaction', () => {
    const rows = buildTimelineRows({
      previousMessageCount: 0,
      messages: [
        { id: 'summary', role: 'compactionSummary', content: ['summary'] },
        assistant('after'),
      ],
    })

    expect(rows.map((row) => row.id)).toEqual(['summary:summary', 'turn:post-summary:summary'])
  })

  it('drops stale collapse state, expands the latest turn, and forces streaming open', () => {
    const messages = [
      user('u1'),
      assistant('a1'),
      user('u2'),
      assistant('a2', 'streaming', ['thinking']),
    ]
    const rows = buildTimelineRows({ messages, previousMessageCount: 0 })
    const state = buildThreadTimelineState({
      rows,
      messages,
      isStreaming: true,
      collapsedRowIds: { stale: true, 'turn:u1': false, 'turn:u2': true },
      forcedExpandedRowId: null,
    })

    expect(state.effectiveCollapsedRowIds).toEqual({
      'turn:u1': false,
      'turn:u2': false,
    })
    expect(state.latestTurnRowId).toBe('turn:u2')
    expect(state.streamingAssistantMessageId).toBe('a2')
    expect(state.streamingTurnRowId).toBe('turn:u2')
  })
})
