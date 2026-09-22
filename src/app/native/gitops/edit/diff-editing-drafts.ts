import { type FileContents, parseDiffFromFile } from '@pierre/diffs'
import { getErrorMessage } from '../../../desktop/error-messages'
import type { ProjectFileWriteResult } from '../../../desktop/types'
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

type DraftWriter = (draft: DiffEditingDraft) => Promise<ProjectFileWriteResult>
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
  const draftsByProjectId = new Map<string, DiffEditingDraft>()
  const listenersByProjectId = new Map<string, Set<DraftListener>>()
  const savesByProjectId = new Map<string, { sessionId: string; promise: Promise<void> }>()

  const notify = (projectId: string) => {
    for (const listener of listenersByProjectId.get(projectId) ?? []) listener()
  }

  const retainFailure = (
    projectId: string,
    sessionId: string,
    error: string,
    reason: 'conflict' | 'other',
  ) => {
    const current = draftsByProjectId.get(projectId)
    if (current?.session.id !== sessionId) return
    draftsByProjectId.set(projectId, {
      ...current,
      status: { kind: 'failed', error, reason },
    })
    notify(projectId)
  }

  const applyWrittenResult = (
    projectId: string,
    savedDraft: DiffEditingDraft,
    result: Extract<ProjectFileWriteResult, { kind: 'written' }>,
  ) => {
    const current = draftsByProjectId.get(projectId)
    if (current?.session.id !== savedDraft.session.id) return
    if (current.version === savedDraft.version) {
      draftsByProjectId.delete(projectId)
    } else {
      draftsByProjectId.set(projectId, {
        ...current,
        session: { ...current.session, expectedRevision: result.file.revision },
        status: { kind: 'ready' },
      })
    }
    notify(projectId)
  }

  return {
    getSnapshot(projectId: string) {
      return draftsByProjectId.get(projectId) ?? null
    },
    getDraft(projectId: string) {
      const draft = draftsByProjectId.get(projectId)
      return draft ? cloneDraft(draft) : null
    },
    updateDraft(projectId: string, session: DiffEditingSession, file: FileContents) {
      const current = draftsByProjectId.get(projectId)
      const continuesSession = current?.session.id === session.id
      const next: DiffEditingDraft = {
        session: continuesSession ? current.session : cloneSession(session),
        file: cloneFile(file),
        recoveryFile: continuesSession ? current.recoveryFile : cloneFile(file),
        version: continuesSession ? current.version + 1 : 1,
        status: continuesSession ? current.status : { kind: 'ready' },
      }
      draftsByProjectId.set(projectId, next)
      notify(projectId)
      return cloneDraft(next)
    },
    discardConflictedDraft(projectId: string, expectedDraft: DiffEditingDraft) {
      const current = draftsByProjectId.get(projectId)
      // Snapshot identity invalidates an open confirmation after any edit, save, or replacement.
      if (
        current !== expectedDraft ||
        current.status.kind !== 'failed' ||
        current.status.reason !== 'conflict' ||
        savesByProjectId.has(projectId)
      ) {
        return false
      }
      draftsByProjectId.delete(projectId)
      notify(projectId)
      return true
    },
    saveDraft(projectId: string, sessionId: string, write: DraftWriter): Promise<void> {
      const activeSave = savesByProjectId.get(projectId)
      if (activeSave?.sessionId === sessionId) return activeSave.promise

      const current = draftsByProjectId.get(projectId)
      if (current?.session.id !== sessionId) return Promise.resolve()

      const savedDraft = cloneDraft(current)
      draftsByProjectId.set(projectId, { ...current, status: { kind: 'saving' } })
      notify(projectId)

      const promise = Promise.resolve().then(async () => {
        try {
          const result = await write(savedDraft)
          if (result.kind === 'written') {
            applyWrittenResult(projectId, savedDraft, result)
            return
          }
          retainFailure(
            projectId,
            sessionId,
            getFileWriteFailure(result),
            result.kind === 'conflict' ? 'conflict' : 'other',
          )
        } catch (error) {
          retainFailure(
            projectId,
            sessionId,
            getErrorMessage(error, `Could not save ${savedDraft.session.path}.`),
            'other',
          )
        } finally {
          const active = savesByProjectId.get(projectId)
          if (active?.sessionId === sessionId) savesByProjectId.delete(projectId)
        }
      })

      savesByProjectId.set(projectId, { sessionId, promise })
      return promise
    },
    subscribe(projectId: string, listener: DraftListener) {
      const listeners = listenersByProjectId.get(projectId) ?? new Set<DraftListener>()
      listeners.add(listener)
      listenersByProjectId.set(projectId, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) listenersByProjectId.delete(projectId)
      }
    },
  }
}

export const diffEditingDraftStore = createDiffEditingDraftStore()
