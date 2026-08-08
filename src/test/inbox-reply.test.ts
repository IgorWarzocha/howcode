import { describe, expect, it } from 'vitest'
import type { ComposerAttachment, DesktopActionResult, InboxThread } from '../app/desktop/types'
import { createInboxReplySubmission, getInboxReplyOutcome } from '../app/inbox/inbox-reply'

const attachment: ComposerAttachment = {
  kind: 'text',
  name: 'notes.md',
  path: '/repo/notes.md',
}

function thread(overrides: Partial<InboxThread> = {}): InboxThread {
  return {
    age: '1m',
    branchName: 'effect-v4',
    content: ['Done.'],
    preview: 'Done.',
    projectId: '/repo',
    projectName: 'repo',
    prompt: 'Please do this.',
    running: false,
    sessionPath: '/sessions/thread.jsonl',
    threadId: 'thread-1',
    title: 'Please do this.',
    unread: true,
    ...overrides,
  }
}

function actionResult(overrides: Partial<DesktopActionResult> = {}): DesktopActionResult {
  return {
    at: '2026-01-01T00:00:00.000Z',
    ok: true,
    payload: {
      action: 'composer.send',
      payload: { projectId: '/repo', text: 'reply' },
    },
    ...overrides,
  }
}

describe('inbox reply contract', () => {
  it('blocks empty and unavailable submissions', () => {
    const base = {
      attachments: [],
      draft: '   ',
      isCompacting: false,
      isSending: false,
      streamingBehavior: 'followUp' as const,
      thread: thread(),
    }

    expect(createInboxReplySubmission(base)).toBeNull()
    expect(
      createInboxReplySubmission({ ...base, attachments: [attachment], isSending: true }),
    ).toBeNull()
    expect(
      createInboxReplySubmission({ ...base, attachments: [attachment], isCompacting: true }),
    ).toBeNull()
  })

  it('builds a trimmed worktree reply without losing attachments or scope', () => {
    expect(
      createInboxReplySubmission({
        attachments: [attachment],
        draft: '  ship it  ',
        isCompacting: false,
        isSending: false,
        streamingBehavior: 'followUp',
        thread: thread(),
      }),
    ).toEqual({
      isCompactCommand: false,
      payload: {
        attachments: [attachment],
        branchName: 'effect-v4',
        composerMode: 'code',
        projectId: '/repo',
        sessionPath: '/sessions/thread.jsonl',
        streamingBehavior: 'followUp',
        suppressInbox: true,
        text: 'ship it',
      },
    })
  })

  it('strips attachments from compact commands and preserves chat scope', () => {
    const submission = createInboxReplySubmission({
      attachments: [attachment],
      draft: ' /compact ',
      isCompacting: false,
      isSending: false,
      streamingBehavior: 'steer',
      thread: thread({ branchName: null, isChat: true }),
    })

    expect(submission).toMatchObject({
      isCompactCommand: true,
      payload: { attachments: [], composerMode: 'chat', text: '/compact' },
    })
  })

  it('classifies backend failures, stopped sends, compact sends, and replies', () => {
    expect(
      getInboxReplyOutcome({
        isCompactCommand: false,
        result: actionResult({ ok: false, result: { error: 'Nope.' } }),
      }),
    ).toEqual({ kind: 'error', message: 'Nope.' })
    expect(
      getInboxReplyOutcome({
        isCompactCommand: false,
        result: actionResult({ result: { composerSendOutcome: 'stopped' } }),
      }),
    ).toEqual({ kind: 'stopped' })
    expect(getInboxReplyOutcome({ isCompactCommand: true, result: actionResult() })).toEqual({
      kind: 'compact-sent',
    })
    expect(getInboxReplyOutcome({ isCompactCommand: false, result: actionResult() })).toEqual({
      kind: 'reply-sent',
    })
  })
})
