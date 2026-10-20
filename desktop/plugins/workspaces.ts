import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { PluginGitProgress } from '@howaboua/howcode-sdk/git-progress'
import type {
  PluginWorkspaceHost,
  WorkspaceHostWorkspace,
} from '@howaboua/howcode-sdk/workspace-host'
import { getDirectoryWorktree } from '../../components/working-directories/service/state.ts'
import { ensureConversationProjection } from '../app-service/conversation-projection.ts'
import { emitDesktopEvent } from '../runtime/desktop-events.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'
import {
  ensureDirectoryWorkspace,
  getWorkspaceNavigationState,
  listWorkspaceActivity,
  renameWorkspace,
} from '../workspace-repository.ts'

async function listWorkspaces(): Promise<WorkspaceHostWorkspace[]> {
  await ensureConversationProjection()
  const activityByWorkspace = new Map(
    listWorkspaceActivity().map((activity) => [activity.workspaceId, activity]),
  )
  return getWorkspaceNavigationState().workspaces.map(({ id, name, directoryId }) => {
    const activity = activityByWorkspace.get(id)
    return {
      id,
      name,
      path: directoryId ?? null,
      lastHumanMessageAt: activity?.lastHumanInputAtMs ?? null,
      lastHowcodeActivityAt: activity?.lastHowcodeActivityAtMs ?? null,
    }
  })
}

export function createPluginWorkspaceHost(gitProgress?: PluginGitProgress): PluginWorkspaceHost {
  return {
    dataDirectory: getDesktopUserDataPath(),
    ...(gitProgress ? { gitProgress } : {}),
    list: listWorkspaces,
    enrol: async (input) => {
      if (!path.isAbsolute(input.path)) throw new Error('Choose an absolute workspace path.')
      const name = input.name?.trim()
      if (name !== undefined && !name) throw new Error('Enter a workspace name.')
      const directoryId = await realpath(input.path)
      if (!(await stat(directoryId)).isDirectory())
        throw new Error('Choose an existing workspace folder.')
      const workspaceId = ensureDirectoryWorkspace(
        getDirectoryWorktree(directoryId)?.rootCwd ?? directoryId,
      )
      if (name !== undefined) renameWorkspace(workspaceId, name)
      emitDesktopEvent({ type: 'shell-state-refresh' })
      const workspace = (await listWorkspaces()).find(({ id }) => id === workspaceId)
      if (!workspace) throw new Error(`Enrolled workspace is unavailable: ${workspaceId}`)
      return workspace
    },
  }
}
