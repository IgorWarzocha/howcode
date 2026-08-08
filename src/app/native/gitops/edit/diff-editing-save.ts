import type { FileContents } from '@pierre/diffs/react'
import type { GitOpsFileActions } from './gitops-file-actions'

export type DiffEditingSession = {
  fileKey: string
  path: string
  expectedRevision: string
  latestFile: FileContents | null
  dirty: boolean
  saving: boolean
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
