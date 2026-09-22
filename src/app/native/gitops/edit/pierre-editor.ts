import type { FileContents } from '@pierre/diffs'
import type {
  EditorFactory,
  EditorInitialState,
  TextDocument as PierreTextDocument,
} from '@pierre/diffs/edit'
import { readClipboardSnapshotQuery } from '../../../query/desktop-query'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import { createDiffEditingFileDiff } from './diff-editing-drafts'
import type { DiffEditingSession } from './diff-editing-save'

const fallbackTextClipboardFormat: string = 'text'

let editorFactory: EditorFactory<GitOpsAnnotationMetadata, undefined> | null = null
let editorModulePromise: Promise<void> | null = null
let TextDocumentConstructor: typeof PierreTextDocument | null = null

export function loadPierreEditor() {
  editorModulePromise ??= import('@pierre/diffs/edit').then(({ Editor, TextDocument }) => {
    TextDocumentConstructor = TextDocument
    editorFactory = (editorType, options, editStateKey) =>
      new Editor(editorType, options, editStateKey)
  })
  return editorModulePromise
}

export function createDiffEditingInitialState(
  session: DiffEditingSession,
  file: FileContents,
): EditorInitialState<'file-diff', GitOpsAnnotationMetadata> {
  if (!TextDocumentConstructor) {
    throw new Error('Pierre editor was not loaded before restoring an edit.')
  }
  const fileDiff = createDiffEditingFileDiff(session.baselineFile, file)
  return {
    type: 'file-diff',
    document: new TextDocumentConstructor(
      `howcode-diff-edit:${session.editStateKey}`,
      file.contents,
      file.lang,
    ),
    fileInfo: {
      name: file.name,
      ...(file.lang ? { lang: file.lang } : {}),
    },
    diffSession: {
      oldFile:
        fileDiff.type === 'new'
          ? null
          : {
              name: fileDiff.prevName ?? fileDiff.name,
              lines: fileDiff.deletionLines,
            },
      type: fileDiff.type,
      hunks: fileDiff.hunks,
    },
  }
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
