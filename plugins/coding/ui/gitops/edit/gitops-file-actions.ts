import type {
  ProjectFileWriteRequest,
  ProjectFileWriteResult,
} from '../../../../../src/app/desktop/types'

export type GitOpsFileActions = {
  write: (request: ProjectFileWriteRequest) => Promise<ProjectFileWriteResult>
}
