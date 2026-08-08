import { describe, expect, it } from 'vitest'
import {
  filterPastSessionThreads,
  getPastSessionThreads,
  getSelectedSessionProjectIds,
} from '../app/sessions/sessions-model'
import { getSelectedSkillInstallSources } from '../app/skills/skill-catalog'
import type { Project, Thread } from '../app/types'

const NOW_MS = Date.UTC(2026, 5, 1)
const OLD_MS = NOW_MS - 8 * 24 * 60 * 60 * 1000

function thread(id: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id,
    title: id,
    age: '8d',
    lastModifiedMs: OLD_MS,
    sessionPath: `/sessions/${id}.jsonl`,
    ...overrides,
  }
}

function project(id: string, threads: Thread[], worktree?: Project['worktree']): Project {
  return {
    id,
    name: id,
    threads,
    ...(worktree ? { worktree } : {}),
  }
}

describe('Pi resource screen models', () => {
  it('collects eligible old sessions from the project and its worktrees', () => {
    const root = project('root', [
      thread('older', { lastModifiedMs: OLD_MS - 1_000 }),
      thread('newer'),
      thread('pinned', { pinned: true }),
      thread('running', { running: true }),
      thread('unread', { unread: true }),
      thread('recent', { lastModifiedMs: NOW_MS }),
    ])
    const worktree = project('worktree', [thread('worktree-thread')], {
      rootProjectId: root.id,
      branchName: 'feature/resource-cleanup',
      isMain: false,
      source: 'howcode',
    })
    const unrelated = project('unrelated', [thread('unrelated-thread')])

    const sessions = getPastSessionThreads(root, [root, worktree, unrelated], NOW_MS)

    expect(sessions.map((session) => session.id)).toEqual(['newer', 'worktree-thread', 'older'])
    expect(sessions[1]).toMatchObject({
      projectId: 'worktree',
      branchName: 'feature/resource-cleanup',
      worktreeLabel: 'feature/resource-cleanup',
    })
  })

  it('searches session titles, summaries, branches, and worktree labels', () => {
    const sessions = getPastSessionThreads(
      project('root', [thread('alpha', { summary: 'database migration' })]),
      [
        project('root', [thread('alpha', { summary: 'database migration' })]),
        project('worktree', [thread('beta')], {
          rootProjectId: 'root',
          branchName: 'feature/sidebar',
          isMain: false,
          source: 'howcode',
        }),
      ],
      NOW_MS,
    )

    expect(filterPastSessionThreads(sessions, 'migration').map((session) => session.id)).toEqual([
      'alpha',
    ])
    expect(filterPastSessionThreads(sessions, 'sidebar').map((session) => session.id)).toEqual([
      'beta',
    ])
    expect(getSelectedSessionProjectIds(sessions, ['alpha', 'beta'])).toEqual(['root', 'worktree'])
  })

  it('turns selected skill identities into unique install sources in selection order', () => {
    const items = [
      {
        id: 'one',
        skillId: 'lint',
        name: 'Lint',
        source: 'owner/repo',
        installs: 10,
        description: null,
        url: 'https://skills.sh/owner/repo/lint',
        sourceUrl: 'https://github.com/owner/repo',
        identityKey: 'owner/repo@lint',
      },
      {
        id: 'two',
        skillId: 'test',
        name: 'Test',
        source: 'owner/repo',
        installs: 5,
        description: null,
        url: 'https://skills.sh/owner/repo/test',
        sourceUrl: 'https://github.com/owner/repo',
        identityKey: 'owner/repo@test',
      },
    ]

    expect(
      getSelectedSkillInstallSources(
        ['owner/repo@test', 'missing', 'owner/repo@lint', 'owner/repo@test'],
        items,
      ),
    ).toEqual(['owner/repo@test', 'owner/repo@lint'])
  })
})
