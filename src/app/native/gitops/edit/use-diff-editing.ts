import type { EditorChangeEvent, EditorFactory, EditorType } from '@pierre/diffs/edit'
import type { CodeViewItem, DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getErrorMessage } from '../../../desktop/error-messages'
import { useLatestRef } from '../../../hooks/useLatestRef'
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
  }
}

function createEditingSession({
  baselineFile,
  expectedRevision,
  fileKey,
  path,
  projectId,
}: {
  baselineFile: DiffEditingSession['baselineFile']
  expectedRevision: string
  fileKey: string
  path: string
  projectId: string
}): DiffEditingSession {
  nextDiffEditingSessionId += 1
  const id = `${Date.now()}:${nextDiffEditingSessionId}`
  return {
    id,
    editStateKey: `gitops:${projectId}:${id}`,
    fileKey,
    path,
    expectedRevision,
    baselineFile,
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
  projectId,
}: {
  fileActions: GitOpsFileActions
  fileContent: DiffFileContentController
  onAnnotationsChange: (
    annotations: readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[],
  ) => void
  projectId: string
}): DiffEditingController {
  const sessionRef = useRef<DiffEditingSession | null>(null)
  const fileActionsRef = useLatestRef(fileActions)
  const subscribeToDraft = useCallback(
    (listener: () => void) => diffEditingDraftStore.subscribe(projectId, listener),
    [projectId],
  )
  const getDraftSnapshot = useCallback(
    () => diffEditingDraftStore.getSnapshot(projectId),
    [projectId],
  )
  const draft = useSyncExternalStore(subscribeToDraft, getDraftSnapshot, getDraftSnapshot)
  const [localState, setLocalState] = useState<DiffEditingState>({ kind: 'idle', error: null })
  const activeSessionRef = useLatestRef(draft?.session ?? sessionRef.current)
  const state = draft ? getDraftState(draft) : localState
  const retainedBaselineFile = draft?.session.baselineFile
  const retainedFileKey = draft?.session.fileKey
  const recoveryFile = draft?.recoveryFile
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

  const start = useCallback(
    async ({ fileDiff, fileKey }: Parameters<DiffEditingController['start']>[0]) => {
      if (diffEditingDraftStore.getSnapshot(projectId) || sessionRef.current) return
      setLocalState({ kind: 'loading', fileKey })
      try {
        const [, prepared] = await Promise.all([
          loadPierreEditor(),
          fileContent.prepareEdit(fileDiff),
        ])
        sessionRef.current = createEditingSession({
          baselineFile: prepared.baselineFile,
          expectedRevision: prepared.revision,
          fileKey,
          path: prepared.path,
          projectId,
        })
        setLocalState({ kind: 'editing', fileKey, dirty: false, saving: false, error: null })
      } catch (error) {
        setLocalState({ kind: 'idle', error: getErrorMessage(error, 'Could not start editing.') })
      }
    },
    [fileContent, projectId],
  )

  const save = useCallback(
    async (fileKey: string) => {
      const currentDraft = diffEditingDraftStore.getSnapshot(projectId)
      const session = currentDraft?.session ?? sessionRef.current
      if (!(session && session.fileKey === fileKey)) return
      if (currentDraft?.session.id !== session.id) {
        sessionRef.current = null
        setLocalState({ kind: 'idle', error: null })
        return
      }

      await diffEditingDraftStore.saveDraft(projectId, session.id, (savedDraft) =>
        writeDiffEditingSession({
          fileActions,
          file: savedDraft.file,
          projectId,
          session: savedDraft.session,
        }),
      )
      if (!diffEditingDraftStore.getSnapshot(projectId)) {
        sessionRef.current = null
        setLocalState({ kind: 'idle', error: null })
      }
    },
    [fileActions, projectId],
  )

  const createEditor = useCallback<DiffEditingController['createEditor']>(
    (editorType, options, editStateKey) => {
      const currentDraft = diffEditingDraftStore.getSnapshot(projectId)
      if (
        editorType !== 'file-diff' ||
        !editStateKey ||
        currentDraft?.session.editStateKey !== editStateKey
      ) {
        return createPierreEditor(editorType, options, editStateKey)
      }
      return createPierreEditor(
        editorType,
        {
          ...options,
          initialState: createDiffEditingInitialState(
            currentDraft.session,
            currentDraft.file,
          ) as NonNullable<typeof options.initialState>,
        },
        editStateKey,
      )
    },
    [projectId],
  )

  const getEditStateKey = useCallback<DiffEditingController['getEditStateKey']>(
    (item) => {
      const session = diffEditingDraftStore.getSnapshot(projectId)?.session ?? sessionRef.current
      return session?.fileKey === item.id ? session.editStateKey : undefined
    },
    [projectId],
  )

  const onItemEditChange = useCallback<DiffEditingController['onItemEditChange']>(
    (event, item) => {
      if (item.type !== 'diff') return
      const session = diffEditingDraftStore.getSnapshot(projectId)?.session ?? sessionRef.current
      if (!(session && session.fileKey === item.id)) return
      diffEditingDraftStore.updateDraft(projectId, session, event.file)
      if (event.lineAnnotations) onAnnotationsChange(getDiffAnnotations(event.lineAnnotations))
    },
    [onAnnotationsChange, projectId],
  )

  // Shell state can replace the action adapter while this editor remains mounted. The project
  // lifetime owns teardown, and cleanup uses whichever imperative adapter is current then.
  useEffect(
    () => () => {
      const session = activeSessionRef.current
      if (!session) return
      void diffEditingDraftStore.saveDraft(projectId, session.id, (savedDraft) =>
        writeDiffEditingSession({
          fileActions: fileActionsRef.current,
          file: savedDraft.file,
          projectId,
          session: savedDraft.session,
        }),
      )
    },
    [activeSessionRef, fileActionsRef, projectId],
  )

  return { state, createEditor, retainedFile, start, save, getEditStateKey, onItemEditChange }
}
