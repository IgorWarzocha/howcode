import { describe, expect, it } from 'vitest'
import {
  createLocalThreadDraft,
  getLocalDraftChatGroupId,
  getLocalDraftProjectId,
} from '../../../shared/session-paths'

describe('composer local draft session paths', () => {
  it('stores the chat group selected when the draft was created', () => {
    const draft = createLocalThreadDraft('/repo', 'token', { chatGroupId: 'group-a' })

    expect(getLocalDraftProjectId(draft.sessionPath)).toBe('/repo')
    expect(getLocalDraftChatGroupId(draft.sessionPath)).toBe('group-a')
  })

  it('keeps code drafts free of chat group state', () => {
    const draft = createLocalThreadDraft('/repo', 'token')

    expect(getLocalDraftChatGroupId(draft.sessionPath)).toBeNull()
  })
})
