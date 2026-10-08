import { type FileContents, parseDiffFromFile } from '@pierre/diffs'
import { getErrorMessage } from '../../../../../src/app/desktop/error-messages'
import type { DirectoryFileWriteResult } from '../../../../../src/app/desktop/types'
import { getFileWriteFailure } from './diff-editing-model'
import type { DiffEditingSession } from './diff-editing-save'

type DiffEditingDraftStatus =
  | { kind: 'ready' }
  | { kind: 'saving' }
  | { kind: 'failed'; error: string; reason: 'conflict' | 'other' }

export type DiffEditingDraft = {
  session: DiffEditingSession
  file: FileContents
  recoveryFile: FileContents
  version: number
  status: DiffEditingDraftStatus
}

export function createDiffEditingFileDiff(baselineFile: FileContents | null, file: FileContents) {
  return parseDiffFromFile(baselineFile, file)
}

type DraftWriter = (draft: DiffEditingDraft) => Promise<DirectoryFileWriteResult>
type DraftListener = () => void

function cloneSession(session: DiffEditingSession): DiffEditingSession {
  return {
    ...session,
    baselineFile: session.baselineFile ? cloneFile(session.baselineFile) : null,
    initialFile: cloneFile(session.initialFile),
  }
}

function cloneFile(file: FileContents): FileContents {
  return { ...file }
}

function cloneDraft(draft: DiffEditingDraft): DiffEditingDraft {
  return {
    session: cloneSession(draft.session),
    file: cloneFile(draft.file),
    recoveryFile: cloneFile(draft.recoveryFile),
    version: draft.version,
    status: { ...draft.status },
  }
}

export function createDiffEditingDraftStore() {
  const draftsByDirectoryId = new Map<string, DiffEditingDraft>()
  const listenersByDirectoryId = new Map<string, Set<DraftListener>>()
  const savesByDirectoryId = new Map<string, { sessionId: string; promise: Promise<void> }>()

  const notify = (directoryId: string) => {
    for (const listener of listenersByDirectoryId.get(directoryId) ?? []) listener()
  }

  const retainFailure = (
    directoryId: string,
    sessionId: string,
    error: string,
    reason: 'conflict' | 'other',
  ) => {
    const current = draftsByDirectoryId.get(directoryId)
    if (current?.session.id !== sessionId) return
    draftsByDirectoryId.set(directoryId, {
      ...current,
      status: { kind: 'failed', error, reason },
    })
    notify(directoryId)
  }

  const applyWrittenResult = (
    directoryId: string,
    savedDraft: DiffEditingDraft,
    result: Extract<DirectoryFileWriteResult, { kind: 'written' }>,
  ) => {
    const current = draftsByDirectoryId.get(directoryId)
    if (current?.session.id !== savedDraft.session.id) return
    if (current.version === savedDraft.version) {
      draftsByDirectoryId.delete(directoryId)
    } else {
      draftsByDirectoryId.set(directoryId, {
        ...current,
        session: { ...current.session, expectedRevision: result.file.revision },
        status: { kind: 'ready' },
      })
    }
    notify(directoryId)
  }

  return {
    getSnapshot(directoryId: string) {
      return draftsByDirectoryId.get(directoryId) ?? null
    },
    getDraft(directoryId: string) {
      const draft = draftsByDirectoryId.get(directoryId)
      return draft ? cloneDraft(draft) : null
    },
    updateDraft(directoryId: string, session: DiffEditingSession, file: FileContents) {
      const current = draftsByDirectoryId.get(directoryId)
      const continuesSession = current?.session.id === session.id
      const next: DiffEditingDraft = {
        session: continuesSession ? current.session : cloneSession(session),
        file: cloneFile(file),
        recoveryFile: continuesSession ? current.recoveryFile : cloneFile(file),
        version: continuesSession ? current.version + 1 : 1,
        status: continuesSession ? current.status : { kind: 'ready' },
      }
      draftsByDirectoryId.set(directoryId, next)
      notify(directoryId)
      return cloneDraft(next)
    },
    discardConflictedDraft(directoryId: string, expectedDraft: DiffEditingDraft) {
      const current = draftsByDirectoryId.get(directoryId)
      // Snapshot identity invalidates an open confirmation after any edit, save, or replacement.
      if (
        current !== expectedDraft ||
        current.status.kind !== 'failed' ||
        current.status.reason !== 'conflict' ||
        savesByDirectoryId.has(directoryId)
      ) {
        return false
      }
      draftsByDirectoryId.delete(directoryId)
      notify(directoryId)
      return true
    },
    saveDraft(directoryId: string, sessionId: string, write: DraftWriter): Promise<void> {
      const activeSave = savesByDirectoryId.get(directoryId)
      if (activeSave?.sessionId === sessionId) return activeSave.promise

      const current = draftsByDirectoryId.get(directoryId)
      if (current?.session.id !== sessionId) return Promise.resolve()

      const savedDraft = cloneDraft(current)
      draftsByDirectoryId.set(directoryId, { ...current, status: { kind: 'saving' } })
      notify(directoryId)

      const promise = Promise.resolve().then(async () => {
        try {
          const result = await write(savedDraft)
          if (result.kind === 'written') {
            applyWrittenResult(directoryId, savedDraft, result)
            return
          }
          retainFailure(
            directoryId,
            sessionId,
            getFileWriteFailure(result),
            result.kind === 'conflict' ? 'conflict' : 'other',
          )
        } catch (error) {
          retainFailure(
            directoryId,
            sessionId,
            getErrorMessage(error, `Could not save ${savedDraft.session.path}.`),
            'other',
          )
        } finally {
          const active = savesByDirectoryId.get(directoryId)
          if (active?.sessionId === sessionId) savesByDirectoryId.delete(directoryId)
        }
      })

      savesByDirectoryId.set(directoryId, { sessionId, promise })
      return promise
    },
    subscribe(directoryId: string, listener: DraftListener) {
      const listeners = listenersByDirectoryId.get(directoryId) ?? new Set<DraftListener>()
      listeners.add(listener)
      listenersByDirectoryId.set(directoryId, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) listenersByDirectoryId.delete(directoryId)
      }
    },
  }
}

export const diffEditingDraftStore = createDiffEditingDraftStore()
