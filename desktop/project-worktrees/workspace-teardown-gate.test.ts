import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { withWorkspaceSessionStart, withWorkspaceTeardown } from './workspace-teardown-gate.ts'

describe('workspace teardown gate', () => {
  it('waits for an accepted start and rejects starts that race with teardown', async () => {
    let releaseStart: (() => void) | undefined
    let startAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      startAccepted = resolve
    })
    const start = withWorkspaceSessionStart('/repo/worktree', async () => {
      startAccepted?.()
      await new Promise<void>((resolve) => {
        releaseStart = resolve
      })
    })
    await accepted

    let teardownStarted = false
    const teardown = withWorkspaceTeardown('/repo/worktree', async () => {
      teardownStarted = true
    })
    await expect(
      withWorkspaceSessionStart('/repo/worktree', async () => undefined),
    ).rejects.toThrow('Workspace is being removed.')
    expect(teardownStarted).toBe(false)

    releaseStart?.()
    await start
    await teardown
    expect(teardownStarted).toBe(true)
  })

  it('treats a symlink alias as the same workspace', async () => {
    const projectId = await mkdtemp(path.join(tmpdir(), 'howcode-workspace-gate-'))
    const alias = `${projectId}-alias`
    await symlink(projectId, alias, 'dir')
    let releaseStart: (() => void) | undefined
    let startAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      startAccepted = resolve
    })

    try {
      const start = withWorkspaceSessionStart(alias, async () => {
        startAccepted?.()
        await new Promise<void>((resolve) => {
          releaseStart = resolve
        })
      })
      await accepted

      let teardownStarted = false
      const teardown = withWorkspaceTeardown(projectId, async () => {
        teardownStarted = true
      })
      await expect(withWorkspaceSessionStart(alias, async () => undefined)).rejects.toThrow(
        'Workspace is being removed.',
      )
      expect(teardownStarted).toBe(false)

      releaseStart?.()
      await Promise.all([start, teardown])
      expect(teardownStarted).toBe(true)
    } finally {
      releaseStart?.()
      await rm(alias, { force: true })
      await rm(projectId, { recursive: true, force: true })
    }
  })
})
