import { useCallback, useMemo } from 'react'
import type {
  DesktopActionInvoker,
  DirectoryFileWriteRequest,
} from '../../../../src/app/desktop/types'
import type { GitOpsFileActions } from '../gitops/index'

export function useGitOpsFileActions(handleAction: DesktopActionInvoker): GitOpsFileActions {
  const write = useCallback(
    async (request: DirectoryFileWriteRequest) => {
      const actionResult = await handleAction('git.write-file', {
        directoryId: request.directoryId,
        filePath: request.path,
        fileContents: request.contents,
        expectedRevision: request.expectedRevision,
      })
      const fileWrite = actionResult?.result?.fileWrite
      if (fileWrite) return fileWrite
      throw new Error(actionResult?.result?.error ?? 'Could not save the workspace file.')
    },
    [handleAction],
  )

  return useMemo(() => ({ write }), [write])
}
