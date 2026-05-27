import { describe, expect, it } from 'vitest'
import { mergeThreadCacheFields } from '../app/app-shell/thread-cache-merge'
import type { Thread } from '../app/desktop/types'

describe('thread cache merge semantics', () => {
  it('treats missing branch metadata as no change', () => {
    const existing = { id: 'thread-1', title: 'Thread', age: 'Now', branchName: 'dev' } as Thread
    const next = { id: 'thread-1', title: 'Running', age: 'Now', running: true } as Thread

    expect(mergeThreadCacheFields(existing, next)).toMatchObject({
      title: 'Running',
      branchName: 'dev',
      running: true,
    })
  })

  it('treats undefined branch metadata as no change', () => {
    const existing = { id: 'thread-1', title: 'Thread', age: 'Now', branchName: 'dev' } as Thread
    const next = {
      id: 'thread-1',
      title: 'Running',
      age: 'Now',
      branchName: undefined,
      running: true,
    } as Thread

    expect(mergeThreadCacheFields(existing, next)).toMatchObject({
      title: 'Running',
      branchName: 'dev',
      running: true,
    })
  })

  it('treats null branch metadata as an explicit clear', () => {
    const existing = { id: 'thread-1', title: 'Thread', age: 'Now', branchName: 'dev' } as Thread
    const next = { id: 'thread-1', title: 'Unassigned', age: 'Now', branchName: null } as Thread

    expect(mergeThreadCacheFields(existing, next)).toMatchObject({
      title: 'Unassigned',
      branchName: null,
    })
  })
})
