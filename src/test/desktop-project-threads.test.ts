import { describe, expect, it } from 'vitest'
import type { Thread } from '../app/desktop/types'
import { preserveLocalDraftThreads } from '../app/hooks/useDesktopProjectThreads'

describe('desktop project thread loading', () => {
  it('keeps optimistic local drafts when fetched project threads are still empty', () => {
    const draft: Thread = {
      id: 'local-thread-1',
      title: 'New thread',
      age: 'Now',
      sessionPath: 'local://%2Frepo%2Fproject-a/draft',
    }

    expect(preserveLocalDraftThreads([], [draft], 'code')).toEqual([draft])
  })

  it('drops a local draft once the fetched thread list contains the same session', () => {
    const persisted: Thread = {
      id: 'thread-1',
      title: 'Real thread',
      age: 'Now',
      sessionPath: '/sessions/thread-1.jsonl',
    }

    expect(
      preserveLocalDraftThreads([persisted], [{ ...persisted, id: 'local-thread-1' }], 'code'),
    ).toEqual([persisted])
  })

  it('keeps local drafts scoped to the requested project thread list', () => {
    const codeDraft: Thread = {
      id: 'local-code-thread',
      title: 'Code thread',
      age: 'Now',
      sessionPath: 'local://project-a/code-draft',
    }
    const chatDraft: Thread = {
      id: 'local-chat-thread',
      title: 'Chat thread',
      age: 'Now',
      sessionPath: 'local://project-a/chat-draft?chatGroupId=group-1',
    }

    expect(preserveLocalDraftThreads([], [codeDraft, chatDraft], 'code')).toEqual([codeDraft])
    expect(preserveLocalDraftThreads([], [codeDraft, chatDraft], 'chat')).toEqual([chatDraft])
  })

  it('can restore drafts cached before switching thread scopes', () => {
    const codeDraft: Thread = {
      id: 'local-code-thread',
      title: 'Code thread',
      age: 'Now',
      sessionPath: 'local://project-a/code-draft',
    }

    expect(preserveLocalDraftThreads([], [], 'code', [codeDraft])).toEqual([codeDraft])
  })

  it('deduplicates the same draft from current and cached project threads', () => {
    const draft: Thread = {
      id: 'local-code-thread',
      title: 'Code thread',
      age: 'Now',
      sessionPath: 'local://project-a/code-draft',
    }

    expect(preserveLocalDraftThreads([], [draft], 'code', [draft])).toEqual([draft])
  })
})
