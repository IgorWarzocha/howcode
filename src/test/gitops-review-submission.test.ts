import { describe, expect, it, vi } from 'vitest'
import type { AppShellController } from '../app/app-shell/useAppShellController'
import type { DesktopActionResult } from '../app/desktop/types'
import {
  createLineRangeTarget,
  type SavedReviewComment,
} from '../app/native/gitops/review/review-model'
import { createReviewStore } from '../app/native/gitops/review/review-store'
import { sendReviewCommentsToComposer } from '../app/native/gitops/review/review-submission'
import { createMemoryStorage } from './helpers/storage'

const contextId = 'review-context'

function savedComment(id: string): SavedReviewComment {
  return {
    id,
    target: createLineRangeTarget({
      fileKey: 'src/app.ts',
      filePath: 'src/app.ts',
      side: 'additions',
      lineNumber: 4,
    }),
    body: `Comment ${id}`,
    purpose: 'comment',
    createdAt: '2026-03-01T12:00:00.000Z',
  }
}

function actionResult(overrides: Partial<DesktopActionResult> = {}): DesktopActionResult {
  return {
    at: '2026-03-01T12:00:00.000Z',
    ok: true,
    payload: { action: 'composer.send', payload: { text: 'review' } },
    ...overrides,
  }
}

function createHarness() {
  const store = createReviewStore({
    storage: createMemoryStorage(),
    beforeUnloadTarget: null,
    debounceMs: 0,
  })
  const first = savedComment('first')
  store.setContext(contextId, { comments: [first], draft: null })
  return { context: store.getContext(contextId)!, first, store }
}

function asHandleAction(
  implementation: () => Promise<DesktopActionResult | null>,
): AppShellController['desktop']['handleAction'] {
  return vi.fn(implementation) as unknown as AppShellController['desktop']['handleAction']
}

describe('GitOps review submission', () => {
  it('keeps comments when the send is stopped or fails', async () => {
    const stopped = createHarness()
    expect(
      await sendReviewCommentsToComposer({
        context: stopped.context,
        contextId,
        handleAction: asHandleAction(async () =>
          actionResult({ result: { composerSendOutcome: 'stopped' } }),
        ),
        store: stopped.store,
        streamingBehavior: 'steer',
      }),
    ).toEqual({ ok: false, error: null })
    expect(stopped.store.getContext(contextId)?.comments).toHaveLength(1)

    const failed = createHarness()
    expect(
      await sendReviewCommentsToComposer({
        context: failed.context,
        contextId,
        handleAction: asHandleAction(async () =>
          actionResult({ ok: false, result: { error: 'Agent unavailable.' } }),
        ),
        store: failed.store,
        streamingBehavior: 'followUp',
      }),
    ).toEqual({ ok: false, error: 'Agent unavailable.' })
    expect(failed.store.getContext(contextId)?.comments).toHaveLength(1)
  })

  it('reports thrown failures without clearing comments', async () => {
    const { context, store } = createHarness()
    const result = await sendReviewCommentsToComposer({
      context,
      contextId,
      handleAction: asHandleAction(async () => {
        throw new Error('Connection lost.')
      }),
      store,
      streamingBehavior: 'followUp',
    })

    expect(result).toEqual({ ok: false, error: 'Connection lost.' })
    expect(store.getContext(contextId)?.comments).toHaveLength(1)
  })

  it('preserves comments added while an earlier snapshot is sending', async () => {
    const { context, store } = createHarness()
    const second = savedComment('second')
    const result = await sendReviewCommentsToComposer({
      context,
      contextId,
      handleAction: asHandleAction(async () => {
        store.setContext(contextId, { comments: [...context.comments, second], draft: null })
        return actionResult()
      }),
      store,
      streamingBehavior: 'followUp',
    })

    expect(result.ok).toBe(true)
    expect(store.getContext(contextId)?.comments).toEqual([second])
  })
})
