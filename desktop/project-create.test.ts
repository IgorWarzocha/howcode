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
const moveProjectToTopMock = vi.fn((projectId: string) => {
  callOrder.push(`top:${projectId}`)
})
const deleteProjectMock = vi.fn((projectId: string) => {
  callOrder.push(`delete:${projectId}`)
})
const hasProjectMock = vi.fn(() => false)
const setProjectRepoOriginMock = vi.fn()

vi.mock('./pi-desktop-runtime.ts', () => ({
  startNewThread: startNewThreadMock,
}))

vi.mock('./thread-state-db.ts', () => ({
  deleteProject: deleteProjectMock,
  ensureProject: ensureProjectMock,
  hasProject: hasProjectMock,
  listProjects: vi.fn(() => []),
  moveProjectToTop: moveProjectToTopMock,
  setProjectRepoOrigin: setProjectRepoOriginMock,
}))

describe('project creation', () => {
  let workspacePath: string

  beforeEach(async () => {
    callOrder.length = 0
    startNewThreadMock.mockClear()
    deleteProjectMock.mockClear()
    hasProjectMock.mockClear()
    hasProjectMock.mockReturnValue(false)
    ensureProjectMock.mockClear()
    moveProjectToTopMock.mockClear()
    setProjectRepoOriginMock.mockClear()
    workspacePath = await mkdtemp(path.join(os.tmpdir(), 'howcode-project-create-workspace-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('creates and orders a plain new project before starting its draft thread', async () => {
    const { createProject } = await import('./project-create.ts')

    const result = await createProject({
      preferredProjectLocation: workspacePath,
      projectName: 'Fresh Project',
      initializeGit: false,
    })

    const projectPath = path.join(workspacePath, 'Fresh Project')
    expect(result.projectId).toBe(projectPath)
    expect(callOrder).toEqual([
      `ensure:${projectPath}`,
      `top:${projectPath}`,
      `start:${projectPath}`,
    ])
  })

  it('adds and orders a folder project before starting its draft thread', async () => {
    const { addProjectFromPath } = await import('./project-create.ts')
    const projectPath = path.join(workspacePath, 'existing-project')

    const result = await addProjectFromPath({
      projectPath,
      createIfMissing: true,
      initializeGit: false,
    })

    expect(result.projectId).toBe(projectPath)
    expect(callOrder).toEqual([
      `ensure:${projectPath}`,
      `top:${projectPath}`,
      `start:${projectPath}`,
    ])
  })

  it('removes the newly-created project row if draft thread startup fails', async () => {
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

    expect(callOrder).toEqual([
      `ensure:${brokenProjectPath}`,
      `top:${brokenProjectPath}`,
      `start:${brokenProjectPath}`,
      `delete:${brokenProjectPath}`,
    ])
  })
})
