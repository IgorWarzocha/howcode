import { describe, expect, it } from 'vitest'
import type { ComposerAttachment, InboxThread } from '../app/desktop/types'
import { createInboxReplySubmission } from '../app/inbox/inbox-reply'

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

describe('inbox reply contract', () => {
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
})
