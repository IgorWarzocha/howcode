import { describe, expect, it } from 'vitest'
import { buildContextualActionPayload } from '../app/app-shell/controller-action-helpers'

const projectId = '/repo/project-a'
const persistedSessionPath = '/sessions/thread-1.jsonl'
const staleLocalSessionPath = 'local://%2Frepo%2Fproject-a/draft-1'

describe('buildContextualActionPayload', () => {
  it('keeps the selected project thread session over stale composer props for follow-up sends', () => {
    expect(
      buildContextualActionPayload({
        action: 'composer.send',
        payload: { text: 'follow up', sessionPath: staleLocalSessionPath },
        composerProjectId: projectId,
        activeView: 'project',
        selectedSessionPath: persistedSessionPath,
      }),
    ).toMatchObject({
      projectId,
      sessionPath: persistedSessionPath,
      text: 'follow up',
    })
  })

  it('still preserves explicit session payloads from non-thread views', () => {
    expect(
      buildContextualActionPayload({
        action: 'composer.send',
        payload: { text: 'inbox follow up', sessionPath: persistedSessionPath },
        composerProjectId: projectId,
        activeView: 'inbox',
        selectedSessionPath: null,
      }),
    ).toMatchObject({ sessionPath: persistedSessionPath })
  })
})
