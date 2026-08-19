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

vi.mock('./pi-desktop-runtime.ts', () => ({
  startNewThread: startNewThreadMock,
}))

vi.mock('./thread-state-db.ts', () => ({
  ensureProject: ensureProjectMock,
  listProjects: vi.fn(() => []),
  setProjectRepoOrigin: setProjectRepoOriginMock,
}))

describe('project creation', () => {
  let workspacePath: string

  beforeEach(async () => {
    callOrder.length = 0
    startNewThreadMock.mockClear()
    ensureProjectMock.mockClear()
    setProjectRepoOriginMock.mockClear()
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
  })
})
