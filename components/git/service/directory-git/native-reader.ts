import { createNativeGitReader } from '@howaboua/pi-durable-git/native'
import type {
  DirectoryDiffFileContentsRequest,
  DirectoryDiffFileContentsResult,
} from '../../../../shared/desktop-contracts.ts'

// This host explicitly authorizes native filesystem and process access.
export const gitReader = createNativeGitReader()

export function loadDirectoryDiffFileContents(
  request: DirectoryDiffFileContentsRequest,
): Promise<DirectoryDiffFileContentsResult> {
  const { directoryId, ...file } = request
  return gitReader.readFileContents({ cwd: directoryId, ...file })
}
