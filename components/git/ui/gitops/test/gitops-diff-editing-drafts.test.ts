import { describe, expect, it } from 'vitest'
import type { DirectoryFileWriteResult } from '../../../../../src/app/desktop/types'
import { createDiffEditingDraftStore } from '../edit/diff-editing-drafts'
import type { DiffEditingSession } from '../edit/diff-editing-save'

function createSession(id: string, expectedRevision = 'revision-1'): DiffEditingSession {
  return {
    id,
    editStateKey: `edit:${id}`,
    fileKey: 'file.txt',
    path: 'file.txt',
    expectedRevision,
    baselineFile: { name: 'file.txt', contents: 'baseline contents' },
    initialFile: { name: 'file.txt', contents: 'initial contents' },
  }
}

function createDraftFile(contents: string) {
  return { name: 'file.txt', contents }
}

function written(revision: string): DirectoryFileWriteResult {
  return {
    kind: 'written',
    file: { path: 'file.txt', contents: 'saved contents', revision },
  }
}

function conflict(): DirectoryFileWriteResult {
  return {
    kind: 'conflict',
    path: 'file.txt',
    expectedRevision: 'revision-1',
    currentRevision: 'external-revision',
  }
}

function requireDraft(
  store: ReturnType<typeof createDiffEditingDraftStore>,
  directoryId = 'project-1',
) {
  const draft = store.getSnapshot(directoryId)
  if (!draft) throw new Error(`Expected a retained draft for ${directoryId}.`)
  return draft
}

describe('GitOps diff editing drafts', () => {
  it.each([
    {
      name: 'conflict',
      write: async (): Promise<DirectoryFileWriteResult> => conflict(),
      error: 'Could not save file.txt because it changed outside Howcode.',
    },
    {
      name: 'unavailable result',
      write: async (): Promise<DirectoryFileWriteResult> => ({
        kind: 'unavailable',
        issue: { kind: 'missing', side: 'new', path: 'file.txt' },
      }),
      error: 'Could not save file.txt.',
    },
    {
      name: 'rejected write',
      write: (): Promise<DirectoryFileWriteResult> => {
        throw new Error('Desktop service disconnected.')
      },
      error: 'Desktop service disconnected.',
    },
  ])('retains the draft and failure after a $name', async ({ error, write }) => {
    const store = createDiffEditingDraftStore()
    const session = createSession('session-1')
    store.updateDraft('project-1', session, createDraftFile('unsaved contents'))

    await store.saveDraft('project-1', session.id, write)

    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'unsaved contents' },
      session,
      status: { kind: 'failed', error },
    })

    store.updateDraft('project-1', session, createDraftFile('newer unsaved contents'))
    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'newer unsaved contents' },
      status: { kind: 'failed', error },
    })

    let retriedContents: string | null = null
    await store.saveDraft('project-1', session.id, async (draft) => {
      retriedContents = draft.file.contents
      return written('revision-2')
    })
    expect(retriedContents).toBe('newer unsaved contents')
    expect(store.getDraft('project-1')).toBeNull()
  })

  it('does not discard a replacement session through a stale conflict action', async () => {
    const store = createDiffEditingDraftStore()
    const firstSession = createSession('session-1')
    store.updateDraft('project-1', firstSession, createDraftFile('first edit'))
    await store.saveDraft('project-1', firstSession.id, async () => conflict())
    const staleConflict = requireDraft(store)

    const replacementSession = createSession('session-2', 'replacement-revision')
    store.updateDraft('project-1', replacementSession, createDraftFile('replacement edit'))

    expect(store.discardConflictedDraft('project-1', staleConflict)).toBe(false)
    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'replacement edit' },
      session: replacementSession,
    })
  })

  it('does not discard through a stale conflict action during or after a newer save', async () => {
    const store = createDiffEditingDraftStore()
    const session = createSession('session-1')
    store.updateDraft('project-1', session, createDraftFile('unsaved contents'))
    await store.saveDraft('project-1', session.id, async () => conflict())
    const staleConflict = requireDraft(store)
    let finishWrite: ((result: DirectoryFileWriteResult) => void) | undefined
    const pendingWrite = new Promise<DirectoryFileWriteResult>((resolve) => {
      finishWrite = resolve
    })

    const saving = store.saveDraft('project-1', session.id, () => pendingWrite)
    expect(store.discardConflictedDraft('project-1', staleConflict)).toBe(false)

    finishWrite?.(conflict())
    await saving
    expect(store.discardConflictedDraft('project-1', staleConflict)).toBe(false)
    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'unsaved contents' },
      status: { kind: 'failed', reason: 'conflict' },
    })
  })

  it('retains newer edits and advances their revision when an older save finishes', async () => {
    const store = createDiffEditingDraftStore()
    const session = createSession('session-1')
    store.updateDraft('project-1', session, createDraftFile('first edit'))
    let finishWrite: ((result: DirectoryFileWriteResult) => void) | undefined
    const pendingWrite = new Promise<DirectoryFileWriteResult>((resolve) => {
      finishWrite = resolve
    })

    const saving = store.saveDraft('project-1', session.id, () => pendingWrite)
    store.updateDraft('project-1', session, createDraftFile('newer edit'))
    finishWrite?.(written('revision-2'))
    await saving

    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'newer edit' },
      session: { id: session.id, expectedRevision: 'revision-2' },
      status: { kind: 'ready' },
    })
  })

  it('does not apply a late save result to a replacement editing session', async () => {
    const store = createDiffEditingDraftStore()
    const firstSession = createSession('session-1')
    store.updateDraft('project-1', firstSession, createDraftFile('first edit'))
    let finishWrite: ((result: DirectoryFileWriteResult) => void) | undefined
    const pendingWrite = new Promise<DirectoryFileWriteResult>((resolve) => {
      finishWrite = resolve
    })
    const saving = store.saveDraft('project-1', firstSession.id, () => pendingWrite)

    const replacementSession = createSession('session-2', 'replacement-revision')
    store.updateDraft('project-1', replacementSession, createDraftFile('replacement edit'))
    finishWrite?.(written('revision-2'))
    await saving

    expect(store.getDraft('project-1')).toMatchObject({
      file: { contents: 'replacement edit' },
      session: replacementSession,
      status: { kind: 'ready' },
    })
  })
})
