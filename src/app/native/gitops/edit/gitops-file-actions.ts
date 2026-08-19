import type { ProjectFileWriteRequest, ProjectFileWriteResult } from '../../../desktop/types'

export type GitOpsFileActions = {
  write: (request: ProjectFileWriteRequest) => Promise<ProjectFileWriteResult>
}
