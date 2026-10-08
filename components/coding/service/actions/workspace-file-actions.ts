import { handledAction } from '../../../../desktop/app-service/action-router-result.ts'
import { getDirectoryFileWriteRequest } from '../../../../shared/desktop-action-payloads.ts'
import type { AnyDesktopActionPayload } from '../../../../shared/desktop-contracts.ts'
import { getDirectoryFileWriteError, writeDirectoryTextFile } from '../directory-git.ts'

export async function handleWriteFileWorkspaceAction(payload: AnyDesktopActionPayload) {
  const request = getDirectoryFileWriteRequest(payload)
  if (!request) return handledAction({ error: 'Invalid project file write request.' })

  const fileWrite = await writeDirectoryTextFile(request)
  return fileWrite.kind === 'written'
    ? handledAction({ didMutate: true, directoryId: request.directoryId, fileWrite })
    : handledAction({ error: getDirectoryFileWriteError(fileWrite), fileWrite })
}
