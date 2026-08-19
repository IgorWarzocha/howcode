import { describe, expect, it } from 'vitest'
import { withRootGitMutation } from './root-git-mutation-gate.ts'

describe('root Git mutation gate', () => {
  it('serializes mutations that resolve to the same root path', async () => {
    let releaseFirst: (() => void) | undefined
    let firstStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve
    })
    const order: string[] = []
    const first = withRootGitMutation('/repo/root', async () => {
      order.push('first-started')
      firstStarted?.()
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      order.push('first-finished')
    })
    await started

    const second = withRootGitMutation('/repo/./root', async () => {
      order.push('second-started')
    })
    await Promise.resolve()
    expect(order).toEqual(['first-started'])

    releaseFirst?.()
    await Promise.all([first, second])
    expect(order).toEqual(['first-started', 'first-finished', 'second-started'])
  })
})
