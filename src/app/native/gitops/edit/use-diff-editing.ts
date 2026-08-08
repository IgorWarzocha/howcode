import type {
  CodeViewItem,
  DiffLineAnnotation,
  FileContents,
  FileDiffMetadata,
  LineAnnotation,
} from '@pierre/diffs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../../../desktop/error-messages'
import type { DiffFileContentController } from '../diff/use-diff-file-content'
import type { ReviewAnnotationMetadata } from '../review/pierre-review-adapter'
import { type DiffEditingState, getFileWriteFailure } from './diff-editing-model'
import { type DiffEditingSession, writeDiffEditingSession } from './diff-editing-save'
import type { GitOpsFileActions } from './gitops-file-actions'
import { loadPierreEditor } from './pierre-editor'

export type DiffEditingController = {
  state: DiffEditingState
  start: (input: { fileDiff: FileDiffMetadata; fileKey: string }) => Promise<void>
  save: (fileKey: string) => Promise<void>
  onItemEditChange: (
    item: CodeViewItem<ReviewAnnotationMetadata>,
    file: FileContents,
    annotations?:
      | LineAnnotation<ReviewAnnotationMetadata>[]
      | DiffLineAnnotation<ReviewAnnotationMetadata>[],
  ) => void
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
    annotations: readonly DiffLineAnnotation<ReviewAnnotationMetadata>[],
  ) => void
  projectId: string
}): DiffEditingController {
  const [state, setState] = useState<DiffEditingState>({ kind: 'idle', error: null })
  const sessionRef = useRef<DiffEditingSession | null>(null)

  const start = useCallback(
    async ({ fileDiff, fileKey }: Parameters<DiffEditingController['start']>[0]) => {
      if (sessionRef.current) return
      setState({ kind: 'loading', fileKey })
      try {
        const [, prepared] = await Promise.all([
          loadPierreEditor(),
          fileContent.prepareEdit(fileDiff),
        ])
        sessionRef.current = {
          fileKey,
          path: prepared.path,
          expectedRevision: prepared.revision,
          latestFile: null,
          dirty: false,
          saving: false,
        }
        setState({ kind: 'editing', fileKey, dirty: false, saving: false, error: null })
      } catch (error) {
        setState({ kind: 'idle', error: getErrorMessage(error, 'Could not start editing.') })
      }
    },
    [fileContent],
  )

  const save = useCallback(
    async (fileKey: string) => {
      const session = sessionRef.current
      if (!(session && session.fileKey === fileKey) || session.saving) return
      if (!session.dirty) {
        sessionRef.current = null
        setState({ kind: 'idle', error: null })
        return
      }

      const latestFile = session.latestFile
      if (!latestFile) {
        setState({
          kind: 'editing',
          fileKey,
          dirty: true,
          saving: false,
          error: 'Could not read the editor contents.',
        })
        return
      }

      session.saving = true
      setState({ kind: 'editing', fileKey, dirty: true, saving: true, error: null })
      try {
        const result = await writeDiffEditingSession({
          fileActions,
          file: latestFile,
          projectId,
          session,
        })
        if (result.kind !== 'written') {
          session.saving = false
          setState({
            kind: 'editing',
            fileKey,
            dirty: true,
            saving: false,
            error: getFileWriteFailure(result),
          })
          return
        }

        sessionRef.current = null
        setState({ kind: 'idle', error: null })
      } catch (error) {
        session.saving = false
        setState({
          kind: 'editing',
          fileKey,
          dirty: true,
          saving: false,
          error: getErrorMessage(error, `Could not save ${session.path}.`),
        })
      }
    },
    [fileActions, projectId],
  )

  const onItemEditChange = useCallback<DiffEditingController['onItemEditChange']>(
    (item, file, annotations) => {
      if (item.type !== 'diff') return
      const session = sessionRef.current
      if (!(session && session.fileKey === item.id)) return
      session.latestFile = file
      session.dirty = true
      if (annotations) {
        const annotationList: readonly (
          | LineAnnotation<ReviewAnnotationMetadata>
          | DiffLineAnnotation<ReviewAnnotationMetadata>
        )[] = annotations
        const diffAnnotations = annotationList.filter(
          (annotation): annotation is DiffLineAnnotation<ReviewAnnotationMetadata> =>
            'side' in annotation,
        )
        onAnnotationsChange(diffAnnotations)
      }
      if (state.kind === 'editing' && state.fileKey === item.id && !state.dirty) {
        setState({ ...state, dirty: true })
      }
    },
    [onAnnotationsChange, state],
  )

  useEffect(
    () => () => {
      const session = sessionRef.current
      if (!(session?.dirty && session.latestFile) || session.saving) return
      void writeDiffEditingSession({
        fileActions,
        file: session.latestFile,
        projectId,
        session,
      })
    },
    [fileActions, projectId],
  )

  return { state, start, save, onItemEditChange }
}
