import type {
  DirectoryFileWriteRequest,
  DirectoryFileWriteResult,
} from '../../../../../src/app/desktop/types'

export type GitOpsFileActions = {
  write: (request: DirectoryFileWriteRequest) => Promise<DirectoryFileWriteResult>
}
