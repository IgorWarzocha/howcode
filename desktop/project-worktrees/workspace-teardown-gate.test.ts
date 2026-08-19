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
})
