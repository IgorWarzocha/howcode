import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  withDirectoryActivity,
  withDirectoryTeardown,
} from '../../../../desktop/runtime/directory-activity.ts'

describe('workspace teardown gate', () => {
  it('waits for accepted activity and rejects activity that races with teardown', async () => {
    let releaseActivity: (() => void) | undefined
    let activityAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      activityAccepted = resolve
    })
    const activity = withDirectoryActivity('/repo/worktree', async () => {
      activityAccepted?.()
      await new Promise<void>((resolve) => {
        releaseActivity = resolve
      })
    })
    await accepted

    let teardownStarted = false
    const teardown = withDirectoryTeardown('/repo/worktree', async () => {
      teardownStarted = true
    })
    await expect(withDirectoryActivity('/repo/worktree', async () => undefined)).rejects.toThrow(
      'Workspace is being removed.',
    )
    expect(teardownStarted).toBe(false)

    releaseActivity?.()
    await activity
    await teardown
    expect(teardownStarted).toBe(true)
  })

  it('treats a symlink alias as the same workspace', async () => {
    const directoryId = await mkdtemp(path.join(tmpdir(), 'howcode-workspace-gate-'))
    const alias = `${directoryId}-alias`
    await symlink(directoryId, alias, 'dir')
    let releaseActivity: (() => void) | undefined
    let activityAccepted: (() => void) | undefined
    const accepted = new Promise<void>((resolve) => {
      activityAccepted = resolve
    })

    try {
      const activity = withDirectoryActivity(alias, async () => {
        activityAccepted?.()
        await new Promise<void>((resolve) => {
          releaseActivity = resolve
        })
      })
      await accepted

      let teardownStarted = false
      const teardown = withDirectoryTeardown(directoryId, async () => {
        teardownStarted = true
      })
      await expect(withDirectoryActivity(alias, async () => undefined)).rejects.toThrow(
        'Workspace is being removed.',
      )
      expect(teardownStarted).toBe(false)

      releaseActivity?.()
      await Promise.all([activity, teardown])
      expect(teardownStarted).toBe(true)
    } finally {
      releaseActivity?.()
      await rm(alias, { force: true })
      await rm(directoryId, { recursive: true, force: true })
    }
  })
})
