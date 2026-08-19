import type { DiffsEditor } from '@pierre/diffs'
import type { EditorOptions } from '@pierre/diffs/edit'
import { readClipboardSnapshotQuery } from '../../../query/desktop-query'

type EditorFactory = <LAnnotation>(options: EditorOptions<LAnnotation>) => DiffsEditor<LAnnotation>
const fallbackTextClipboardFormat: string = 'text'

let editorFactory: EditorFactory | null = null
let editorModulePromise: Promise<void> | null = null

export function loadPierreEditor() {
  editorModulePromise ??= import('@pierre/diffs/edit').then(({ Editor }) => {
    editorFactory = <LAnnotation>(options: EditorOptions<LAnnotation>) =>
      new Editor<LAnnotation>(options)
  })
  return editorModulePromise
}

export const createPierreEditor: EditorFactory = (options) => {
  if (!editorFactory) throw new Error('Pierre editor was not loaded before editing started.')
  return editorFactory(options)
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
