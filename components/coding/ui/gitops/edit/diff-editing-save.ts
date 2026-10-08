import type { FileContents } from '@pierre/diffs/react'
import type { GitOpsFileActions } from './gitops-file-actions'

export type DiffEditingSession = {
  id: string
  editStateKey: string
  fileKey: string
  path: string
  expectedRevision: string
  baselineFile: FileContents | null
  initialFile: FileContents
}

export function writeDiffEditingSession({
  fileActions,
  file,
  directoryId,
  session,
}: {
  fileActions: GitOpsFileActions
  file: FileContents
  directoryId: string
  session: DiffEditingSession
}) {
  return fileActions.write({
    directoryId,
    path: session.path,
    contents: file.contents,
    expectedRevision: session.expectedRevision,
  })
}
