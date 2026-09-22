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
  projectId,
  session,
}: {
  fileActions: GitOpsFileActions
  file: FileContents
  projectId: string
  session: DiffEditingSession
}) {
  return fileActions.write({
    projectId,
    path: session.path,
    contents: file.contents,
    expectedRevision: session.expectedRevision,
  })
}
