import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callOrder: string[] = []
const startNewThreadMock = vi.fn(async (request: { projectId?: string }) => {
  callOrder.push(`start:${request.projectId ?? ''}`)
  return {
    projectId: request.projectId,
    sessionPath: `${request.projectId ?? 'missing'}/.pi/sessions/draft.jsonl`,
    threadId: 'draft-thread',
  }
})
const ensureProjectMock = vi.fn((projectId: string) => {
  callOrder.push(`ensure:${projectId}`)
})
const setProjectRepoOriginMock = vi.fn()
const upsertProjectWorktreeMock = vi.fn()
const captureGitRepositoryIdentityMock = vi.fn()
const getMainWorktreePathMock = vi.fn()
const initializeProjectGitMock = vi.fn()

vi.mock('./pi-desktop-runtime.ts', () => ({
  startNewThread: startNewThreadMock,
}))

vi.mock('./thread-state-db.ts', () => ({
  ensureProject: ensureProjectMock,
  listProjects: vi.fn(() => []),
  setProjectRepoOrigin: setProjectRepoOriginMock,
  upsertProjectWorktree: upsertProjectWorktreeMock,
}))

vi.mock('./project-git/repository-identity.ts', () => ({
  captureGitRepositoryIdentity: captureGitRepositoryIdentityMock,
}))

vi.mock('./project-git.ts', () => ({
  getMainWorktreePath: getMainWorktreePathMock,
  initializeProjectGit: initializeProjectGitMock,
}))

describe('project creation', () => {
  let workspacePath: string

  beforeEach(async () => {
    callOrder.length = 0
    startNewThreadMock.mockClear()
    ensureProjectMock.mockClear()
    setProjectRepoOriginMock.mockClear()
    upsertProjectWorktreeMock.mockClear()
    captureGitRepositoryIdentityMock.mockReset()
    captureGitRepositoryIdentityMock.mockResolvedValue(null)
    getMainWorktreePathMock.mockReset()
    getMainWorktreePathMock.mockImplementation(async (projectId: string) => projectId)
    initializeProjectGitMock.mockReset()
    workspacePath = await mkdtemp(path.join(os.tmpdir(), 'howcode-project-create-workspace-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('does not insert the project row if draft thread startup fails', async () => {
    const { createProject } = await import('./project-create.ts')
    const brokenProjectPath = path.join(workspacePath, 'Broken Project')
    startNewThreadMock.mockImplementationOnce(async (request: { projectId?: string }) => {
      callOrder.push(`start:${request.projectId ?? ''}`)
      throw new Error('runtime failed')
    })

    await expect(
      createProject({
        preferredProjectLocation: workspacePath,
        projectName: 'Broken Project',
        initializeGit: false,
      }),
    ).rejects.toThrow('runtime failed')

    expect(callOrder).toEqual([`start:${brokenProjectPath}`])
    expect(captureGitRepositoryIdentityMock).not.toHaveBeenCalled()
  })

  it('records Git root provenance before a newly visible project can be deleted', async () => {
    const { createProject } = await import('./project-create.ts')
    const projectPath = path.join(workspacePath, 'Git Project')
    captureGitRepositoryIdentityMock.mockResolvedValueOnce({
      topLevelIdentity: projectPath,
      commonDirectoryIdentity: 'git-common-dir-v1:1:2:3',
    })

    await createProject({
      preferredProjectLocation: workspacePath,
      projectName: 'Git Project',
      initializeGit: false,
    })

    expect(callOrder).toEqual([`start:${projectPath}`, `ensure:${projectPath}`])
    expect(upsertProjectWorktreeMock).toHaveBeenCalledWith({
      cwd: projectPath,
      rootCwd: projectPath,
      branchName: null,
      gitCommonDirectoryIdentity: 'git-common-dir-v1:1:2:3',
      isMain: true,
      source: 'howcode',
    })
  })

  it('does not register a linked worktree as its own main worktree', async () => {
    const { createProject } = await import('./project-create.ts')
    const projectPath = path.join(workspacePath, 'Linked Worktree')
    captureGitRepositoryIdentityMock.mockResolvedValueOnce({
      topLevelIdentity: projectPath,
      commonDirectoryIdentity: 'git-common-dir-v1:1:2:3',
    })
    getMainWorktreePathMock.mockResolvedValueOnce(path.join(workspacePath, 'Main Worktree'))

    await createProject({
      preferredProjectLocation: workspacePath,
      projectName: 'Linked Worktree',
      initializeGit: false,
    })

    expect(upsertProjectWorktreeMock).not.toHaveBeenCalled()
  })
})
