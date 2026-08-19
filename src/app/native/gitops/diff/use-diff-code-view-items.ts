import type { CodeViewItem } from '@pierre/diffs'
import type { CodeViewHandle, DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DiffEditingController } from '../edit/use-diff-editing'
import type { GitOpsAnnotationMetadata } from '../review/pierre-review-adapter'
import { getDiffFileIdentity } from './diff-file-identity'
import { isImageDiffFile } from './diff-panel-content.helpers'

type DiffCodeViewItem = CodeViewItem<GitOpsAnnotationMetadata> & { type: 'diff' }
type ItemSyncState = { ids: string[]; versions: Map<string, number | undefined> }

function hashString(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index)
  }
  return hash >>> 0
}

function getAnnotationVersionKey(
  annotations: readonly DiffLineAnnotation<GitOpsAnnotationMetadata>[],
) {
  return annotations
    .map((annotation) => {
      const metadata = annotation.metadata.gitOps
      if (metadata.kind === 'change-action') {
        return `change:${metadata.fileKey}:${metadata.hunkIndex}:${annotation.side}:${annotation.lineNumber}`
      }
      const { review } = metadata
      return `${review.id}:${review.kind}:${annotation.side}:${annotation.lineNumber}:${review.kind === 'comment' ? review.body.length : 0}`
    })
    .join('|')
}

function getItemSyncState(items: readonly DiffCodeViewItem[]): ItemSyncState {
  return {
    ids: items.map((item) => item.id),
    versions: new Map(items.map((item) => [item.id, item.version])),
  }
}

function isAppendOnly(previousIds: readonly string[], nextIds: readonly string[]) {
  return (
    previousIds.length <= nextIds.length &&
    previousIds.every((previousId, index) => previousId === nextIds[index])
  )
}

function syncAppendOnlyItems({
  handle,
  items,
  previous,
}: {
  handle: CodeViewHandle<GitOpsAnnotationMetadata>
  items: readonly DiffCodeViewItem[]
  previous: ItemSyncState
}) {
  for (const item of items.slice(0, previous.ids.length)) {
    if (previous.versions.get(item.id) !== item.version) handle.updateItem(item)
  }
  const appendedItems = items.slice(previous.ids.length)
  if (appendedItems.length > 0) handle.addItems(appendedItems)
}

export function useDiffCodeViewItems({
  annotationsByFile,
  collapsedFiles,
  codeViewRef,
  focusedImageFileKeys,
  editing,
  renderableFiles,
}: {
  annotationsByFile: Map<string, DiffLineAnnotation<GitOpsAnnotationMetadata>[]>
  collapsedFiles: Record<string, boolean>
  codeViewRef: React.RefObject<CodeViewHandle<GitOpsAnnotationMetadata> | null>
  focusedImageFileKeys: ReadonlySet<string>
  editing: DiffEditingController
  renderableFiles: readonly FileDiffMetadata[]
}) {
  const items = useMemo<DiffCodeViewItem[]>(
    () =>
      renderableFiles.map((fileDiff) => {
        const { fileKey } = getDiffFileIdentity(fileDiff)
        const isImageFile = isImageDiffFile(fileDiff)
        const annotations = annotationsByFile.get(fileKey) ?? []
        const collapsed = focusedImageFileKeys.has(fileKey)
          ? false
          : (collapsedFiles[fileKey] ?? isImageFile)
        const edit = editing.state.kind === 'editing' && editing.state.fileKey === fileKey
        return {
          id: fileKey,
          type: 'diff',
          fileDiff,
          annotations,
          collapsed,
          edit,
          version: hashString(
            `${fileKey}:${fileDiff.unifiedLineCount}:${fileDiff.splitLineCount}:${getAnnotationVersionKey(annotations)}:${collapsed ? 1 : 0}:${edit ? 1 : 0}`,
          ),
        }
      }),
    [annotationsByFile, collapsedFiles, editing.state, focusedImageFileKeys, renderableFiles],
  )
  const [handle, setHandleState] = useState<CodeViewHandle<GitOpsAnnotationMetadata> | null>(null)
  const syncStateRef = useRef<ItemSyncState>({ ids: [], versions: new Map() })

  const setHandle = useCallback(
    (nextHandle: CodeViewHandle<GitOpsAnnotationMetadata> | null) => {
      codeViewRef.current = nextHandle
      if (!nextHandle) syncStateRef.current = { ids: [], versions: new Map() }
      setHandleState(nextHandle)
    },
    [codeViewRef],
  )

  useEffect(() => {
    const instance = handle?.getInstance()
    if (!(handle && instance)) return

    const previous = syncStateRef.current
    const next = getItemSyncState(items)
    if (isAppendOnly(previous.ids, next.ids)) {
      syncAppendOnlyItems({ handle, items, previous })
    } else {
      instance.setItems(items)
    }
    syncStateRef.current = next
  }, [handle, items])

  return setHandle
}
