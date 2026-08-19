import type { AnyDesktopActionPayload } from '../../shared/desktop-contracts.ts'
import { getProjectFileWriteRequest } from '../../shared/pi-thread-action-payloads.ts'
import { getProjectFileWriteError, writeProjectTextFile } from '../project-git.ts'
import { handledAction } from './action-router-result.ts'

export async function handleWriteFileWorkspaceAction(payload: AnyDesktopActionPayload) {
  const request = getProjectFileWriteRequest(payload)
  if (!request) return handledAction({ error: 'Invalid project file write request.' })

  const fileWrite = await writeProjectTextFile(request)
  return fileWrite.kind === 'written'
    ? handledAction({ didMutate: true, projectId: request.projectId, fileWrite })
    : handledAction({ error: getProjectFileWriteError(fileWrite), fileWrite })
}
