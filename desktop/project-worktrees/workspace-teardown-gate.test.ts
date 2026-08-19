import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { withWorkspaceActivity, withWorkspaceTeardown } from './workspace-teardown-gate.ts'

describe('workspace teardown gate', () => {
  it('waits for accepted activity and rejects activity that races with teardown', async () => {
    let releaseActivity: (() => void) | undefined
    let activityAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      activityAccepted = resolve
    })
    const activity = withWorkspaceActivity('/repo/worktree', async () => {
      activityAccepted?.()
      await new Promise<void>((resolve) => {
        releaseActivity = resolve
      })
    })
    await accepted

    let teardownStarted = false
    const teardown = withWorkspaceTeardown('/repo/worktree', async () => {
      teardownStarted = true
    })
    await expect(withWorkspaceActivity('/repo/worktree', async () => undefined)).rejects.toThrow(
      'Workspace is being removed.',
    )
    expect(teardownStarted).toBe(false)

    releaseActivity?.()
    await activity
    await teardown
    expect(teardownStarted).toBe(true)
  })

  it('treats a symlink alias as the same workspace', async () => {
    const projectId = await mkdtemp(path.join(tmpdir(), 'howcode-workspace-gate-'))
    const alias = `${projectId}-alias`
    await symlink(projectId, alias, 'dir')
    let releaseActivity: (() => void) | undefined
    let activityAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      activityAccepted = resolve
    })

    try {
      const activity = withWorkspaceActivity(alias, async () => {
        activityAccepted?.()
        await new Promise<void>((resolve) => {
          releaseActivity = resolve
        })
      })
      await accepted

      let teardownStarted = false
      const teardown = withWorkspaceTeardown(projectId, async () => {
        teardownStarted = true
      })
      await expect(withWorkspaceActivity(alias, async () => undefined)).rejects.toThrow(
        'Workspace is being removed.',
      )
      expect(teardownStarted).toBe(false)

      releaseActivity?.()
      await Promise.all([activity, teardown])
      expect(teardownStarted).toBe(true)
    } finally {
      releaseActivity?.()
      await rm(alias, { force: true })
      await rm(projectId, { recursive: true, force: true })
    }
  })
})
