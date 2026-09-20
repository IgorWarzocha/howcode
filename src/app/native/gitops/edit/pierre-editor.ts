import type { EditorFactory } from '@pierre/diffs/edit'
import { readClipboardSnapshotQuery } from '../../../query/desktop-query'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'

const fallbackTextClipboardFormat: string = 'text'

let editorFactory: EditorFactory<GitOpsAnnotationMetadata, undefined> | null = null
let editorModulePromise: Promise<void> | null = null

export function loadPierreEditor() {
  editorModulePromise ??= import('@pierre/diffs/edit').then(({ Editor }) => {
    editorFactory = (editorType, options, editStateKey) =>
      new Editor(editorType, options, editStateKey)
  })
  return editorModulePromise
}

export const createPierreEditor: EditorFactory<GitOpsAnnotationMetadata, undefined> = (
  editorType,
  options,
  editStateKey,
) => {
  if (!editorFactory) throw new Error('Pierre editor was not loaded before editing started.')
  return editorFactory(editorType, options, editStateKey)
}

export const pierreEditorOptions = {
  clipboard: {
    readText: async (type = 'text/plain') => {
      const snapshot = await readClipboardSnapshotQuery([type, 'text/plain', 'text'])
      return (
        snapshot?.valuesByFormat[type] ??
        snapshot?.valuesByFormat['text/plain'] ??
        snapshot?.valuesByFormat[fallbackTextClipboardFormat] ??
        ''
      )
    },
  },
}
