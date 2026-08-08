import type { GitOpsFileActions } from '@howcode/native-gitops'
import { useCallback, useMemo } from 'react'
import type { AppShellController } from '../app-shell/useAppShellController'
import type { ProjectFileWriteRequest } from '../desktop/types'

export function useGitOpsFileActions(
  handleAction: AppShellController['handleAction'],
): GitOpsFileActions {
  const write = useCallback(
    async (request: ProjectFileWriteRequest) => {
      const actionResult = await handleAction('workspace.write-file', {
        projectId: request.projectId,
        filePath: request.path,
        fileContents: request.contents,
        expectedRevision: request.expectedRevision,
      })
      const fileWrite = actionResult?.result?.fileWrite
      if (fileWrite) return fileWrite
      throw new Error(actionResult?.result?.error ?? 'Could not save the project file.')
    },
    [handleAction],
  )

  return useMemo(() => ({ write }), [write])
}
