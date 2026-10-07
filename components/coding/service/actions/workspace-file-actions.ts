import { handledAction } from '../../../../desktop/app-service/action-router-result.ts'
import { getProjectFileWriteRequest } from '../../../../shared/desktop-action-payloads.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import { getProjectFileWriteError, writeProjectTextFile } from '../project-git.ts'

export async function handleWriteFileWorkspaceAction(payload: AnyDesktopActionPayload) {
  const request = getProjectFileWriteRequest(payload)
  if (!request) return handledAction({ error: 'Invalid project file write request.' })

  const fileWrite = await writeProjectTextFile(request)
  return fileWrite.kind === 'written'
    ? handledAction({ didMutate: true, projectId: request.projectId, fileWrite })
    : handledAction({ error: getProjectFileWriteError(fileWrite), fileWrite })
}
