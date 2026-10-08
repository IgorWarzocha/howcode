import type { EditorChangeEvent, EditorFactory, EditorType } from '@pierre/diffs/edit'
import type { CodeViewItem, DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getErrorMessage } from '../../../../../src/app/desktop/error-messages'
import { useLatestRef } from '../../../../../src/app/hooks/useLatestRef'
import type { DiffFileContentController } from '../diff/use-diff-file-content'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import {
  createDiffEditingFileDiff,
  type DiffEditingDraft,
  diffEditingDraftStore,
} from './diff-editing-drafts'
import type { DiffEditingState } from './diff-editing-model'
import { type DiffEditingSession, writeDiffEditingSession } from './diff-editing-save'
import type { GitOpsFileActions } from './gitops-file-actions'
import {
  createDiffEditingInitialState,
  createPierreEditor,
  loadPierreEditor,
} from './pierre-editor'

export type DiffEditingController = {
  state: DiffEditingState
  createEditor: EditorFactory<GitOpsAnnotationMetadata, undefined>
  retainedFile: { fileKey: string; resolveFileDiff: () => FileDiffMetadata } | null
  start: (input: { fileDiff: FileDiffMetadata; fileKey: string }) => Promise<void>
  save: (fileKey: string) => Promise<void>
  discardAndReload: (input: { fileDiff: FileDiffMetadata; fileKey: string }) => Promise<void>
  getEditStateKey: (item: CodeViewItem<GitOpsAnnotationMetadata>) => string | undefined
  onItemEditChange: (
    event: EditorChangeEvent<EditorType, GitOpsAnnotationMetadata, undefined>,
    item: CodeViewItem<GitOpsAnnotationMetadata>,
  ) => void
}

let nextDiffEditingSessionId = 0

function getDraftState(draft: DiffEditingDraft): DiffEditingState {
  return {
    kind: 'editing',
    fileKey: draft.session.fileKey,
    dirty: true,
    saving: draft.status.kind === 'saving',
    error: draft.status.kind === 'failed' ? draft.status.error : null,
    canDiscardAndReload: draft.status.kind === 'failed' && draft.status.reason === 'conflict',
  }
}

function createEditingSession({
  baselineFile,
  expectedRevision,
  initialFile,
  fileKey,
  path,
  directoryId,
}: {
  baselineFile: DiffEditingSession['baselineFile']
  expectedRevision: string
  initialFile: DiffEditingSession['initialFile']
  fileKey: string
  path: string
  directoryId: string
}): DiffEditingSession {
  nextDiffEditingSessionId += 1
  const id = `${Date.now()}:${nextDiffEditingSessionId}`
  return {
    id,
    editStateKey: `gitops:${directoryId}:${id}`,
    fileKey,
    path,
    expectedRevision,
    baselineFile,
    initialFile,
  }
}

function getDiffAnnotations(
  annotations: EditorChangeEvent<
    EditorType,
    GitOpsAnnotationMetadata,
    undefined
  >['lineAnnotations'],
) {
  if (!annotations) return []
  return annotations.filter(
    (annotation): annotation is DiffLineAnnotation<GitOpsAnnotationMetadata> =>
      'side' in annotation,
  )
}

export function useDiffEditing({
  fileActions,
  fileContent,
  onAnnotationsChange,
  directoryId,
}: {
  fileActions: GitOpsFileActions
  fileContent: DiffFileContentController
  onAnnotationsChange: (
    annotations: readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[],
  ) => void
  directoryId: string
}): DiffEditingController {
  const sessionRef = useRef<DiffEditingSession | null>(null)
  const preparingRef = useRef<object | null>(null)
  const fileActionsRef = useLatestRef(fileActions)
  const subscribeToDraft = useCallback(
    (listener: () => void) => diffEditingDraftStore.subscribe(directoryId, listener),
    [directoryId],
  )
  const getDraftSnapshot = useCallback(
    () => diffEditingDraftStore.getSnapshot(directoryId),
    [directoryId],
  )
  const draft = useSyncExternalStore(subscribeToDraft, getDraftSnapshot, getDraftSnapshot)
  const [localState, setLocalState] = useState<DiffEditingState>({ kind: 'idle', error: null })
  const activeSessionRef = useLatestRef(draft?.session ?? sessionRef.current)
  const state = draft ? getDraftState(draft) : localState
  const retainedSession =
    draft?.session ?? (localState.kind === 'editing' ? sessionRef.current : null)
  const retainedBaselineFile = retainedSession?.baselineFile
  const retainedFileKey = retainedSession?.fileKey
  const recoveryFile = draft?.recoveryFile ?? retainedSession?.initialFile
  const retainedFile = useMemo(
    () =>
      retainedFileKey && recoveryFile
        ? {
            fileKey: retainedFileKey,
            resolveFileDiff: () =>
              createDiffEditingFileDiff(retainedBaselineFile ?? null, recoveryFile),
          }
        : null,
    [recoveryFile, retainedBaselineFile, retainedFileKey],
  )

  const prepareEditing = useCallback(
    async ({ fileDiff, fileKey }: Parameters<DiffEditingController['start']>[0]) => {
      if (preparingRef.current) return
      const preparation = {}
      preparingRef.current = preparation
      setLocalState({ kind: 'loading', fileKey })
      try {
        const [, prepared] = await Promise.all([
          loadPierreEditor(),
          fileContent.prepareEdit(fileDiff),
        ])
        if (preparingRef.current !== preparation) return
        sessionRef.current = createEditingSession({
          baselineFile: prepared.baselineFile,
          expectedRevision: prepared.revision,
          initialFile: prepared.file,
          fileKey,
          path: prepared.path,
          directoryId,
        })
        setLocalState({
          kind: 'editing',
          fileKey,
          dirty: false,
          saving: false,
          error: null,
          canDiscardAndReload: false,
        })
      } catch (error) {
        if (preparingRef.current !== preparation) return
        setLocalState({ kind: 'idle', error: getErrorMessage(error, 'Could not start editing.') })
      } finally {
        if (preparingRef.current === preparation) preparingRef.current = null
      }
    },
    [fileContent, directoryId],
  )

  const start = useCallback(
    async (input: Parameters<DiffEditingController['start']>[0]) => {
      if (
        preparingRef.current ||
        diffEditingDraftStore.getSnapshot(directoryId) ||
        sessionRef.current
      ) {
        return
      }
      await prepareEditing(input)
    },
    [prepareEditing, directoryId],
  )

  const save = useCallback(
    async (fileKey: string) => {
      const currentDraft = diffEditingDraftStore.getSnapshot(directoryId)
      const session = currentDraft?.session ?? sessionRef.current
      if (!(session && session.fileKey === fileKey)) return
      if (currentDraft?.session.id !== session.id) {
        sessionRef.current = null
        setLocalState({ kind: 'idle', error: null })
        return
      }

      await diffEditingDraftStore.saveDraft(directoryId, session.id, (savedDraft) =>
        writeDiffEditingSession({
          fileActions,
          file: savedDraft.file,
          directoryId,
          session: savedDraft.session,
        }),
      )
      if (!diffEditingDraftStore.getSnapshot(directoryId)) {
        sessionRef.current = null
        setLocalState({ kind: 'idle', error: null })
      }
    },
    [fileActions, directoryId],
  )

  const discardAndReload = useCallback(
    async (input: Parameters<DiffEditingController['discardAndReload']>[0]) => {
      const expectedDraft = draft
      if (
        !expectedDraft ||
        expectedDraft.session.fileKey !== input.fileKey ||
        expectedDraft.status.kind !== 'failed' ||
        expectedDraft.status.reason !== 'conflict' ||
        preparingRef.current
      ) {
        return
      }
      if (!diffEditingDraftStore.discardConflictedDraft(directoryId, expectedDraft)) return

      if (sessionRef.current?.id === expectedDraft.session.id) sessionRef.current = null
      activeSessionRef.current = null
      await prepareEditing(input)
    },
    [activeSessionRef, draft, prepareEditing, directoryId],
  )

  const createEditor = useCallback<DiffEditingController['createEditor']>(
    (editorType, options, editStateKey) => {
      const currentDraft = diffEditingDraftStore.getSnapshot(directoryId)
      const session = currentDraft?.session ?? sessionRef.current
      const initialFile = currentDraft?.file ?? session?.initialFile
      if (
        editorType !== 'file-diff' ||
        !editStateKey ||
        session?.editStateKey !== editStateKey ||
        !initialFile
      ) {
        return createPierreEditor(editorType, options, editStateKey)
      }
      return createPierreEditor(
        editorType,
        {
          ...options,
          initialState: createDiffEditingInitialState(session, initialFile) as NonNullable<
            typeof options.initialState
          >,
        },
        editStateKey,
      )
    },
    [directoryId],
  )

  const getEditStateKey = useCallback<DiffEditingController['getEditStateKey']>(
    (item) => {
      const session = diffEditingDraftStore.getSnapshot(directoryId)?.session ?? sessionRef.current
      return session?.fileKey === item.id ? session.editStateKey : undefined
    },
    [directoryId],
  )

  const onItemEditChange = useCallback<DiffEditingController['onItemEditChange']>(
    (event, item) => {
      if (item.type !== 'diff') return
      const session = diffEditingDraftStore.getSnapshot(directoryId)?.session ?? sessionRef.current
      if (!(session && session.fileKey === item.id)) return
      diffEditingDraftStore.updateDraft(directoryId, session, event.file)
      if (event.lineAnnotations) onAnnotationsChange(getDiffAnnotations(event.lineAnnotations))
    },
    [onAnnotationsChange, directoryId],
  )

  // Shell state can replace the action adapter while this editor remains mounted. The directory
  // lifetime owns teardown, and cleanup uses whichever imperative adapter is current then.
  useEffect(
    () => () => {
      preparingRef.current = null
      const session = activeSessionRef.current
      if (!session) return
      void diffEditingDraftStore.saveDraft(directoryId, session.id, (savedDraft) =>
        writeDiffEditingSession({
          fileActions: fileActionsRef.current,
          file: savedDraft.file,
          directoryId,
          session: savedDraft.session,
        }),
      )
    },
    [activeSessionRef, fileActionsRef, directoryId],
  )

  return {
    state,
    createEditor,
    retainedFile,
    start,
    save,
    discardAndReload,
    getEditStateKey,
    onItemEditChange,
  }
}
