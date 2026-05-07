import { describe, expect, it } from 'vitest'
import { desktopQueryKeys } from '../../app/query/desktop-query'

describe('composer query keys', () => {
  it('separates composer state by chat group', () => {
    const baseRequest = {
      projectId: '/repo',
      sessionPath: null,
      composerMode: 'chat' as const,
    }

    expect(desktopQueryKeys.composerState({ ...baseRequest, chatGroupId: 'group-a' })).not.toEqual(
      desktopQueryKeys.composerState({ ...baseRequest, chatGroupId: 'group-b' }),
    )
  })

  it('keeps code and chat composer keys distinct', () => {
    expect(
      desktopQueryKeys.composerState({ projectId: '/repo', composerMode: 'code' }),
    ).not.toEqual(
      desktopQueryKeys.composerState({
        projectId: '/repo',
        composerMode: 'chat',
        chatGroupId: 'group-a',
      }),
    )
  })
})
