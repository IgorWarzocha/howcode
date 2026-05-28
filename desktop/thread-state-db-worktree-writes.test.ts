import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let userDataPath = ''

describe('thread state db worktree writes', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(path.join(os.tmpdir(), 'howcode-worktree-db-'))
    // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
    process.env['HOWCODE_USER_DATA_PATH'] = userDataPath
  })

  afterEach(async () => {
    const { closeThreadStateDatabaseForTests } = await import('./thread-state-db/db.ts')
    closeThreadStateDatabaseForTests()
    // biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
    delete process.env['HOWCODE_USER_DATA_PATH']
    if (userDataPath) rmSync(userDataPath, { recursive: true, force: true })
  })

  it('preserves recorded parent branch metadata when a later worktree sync has no parent', async () => {
    const { getThreadStateDatabase } = await import('./thread-state-db/db.ts')
    const { upsertProjectWorktree } = await import('./thread-state-db/worktree-writes.ts')
    const db = getThreadStateDatabase()
    db.prepare('INSERT INTO projects (cwd, name) VALUES (?, ?)').run('/repo', 'Repo')
    db.prepare('INSERT INTO projects (cwd, name) VALUES (?, ?)').run(
      '/repo/.worktrees/feature',
      'Feature',
    )

    upsertProjectWorktree({
      cwd: '/repo/.worktrees/feature',
      rootCwd: '/repo',
      branchName: 'feature',
      parentBranchName: 'main',
      isMain: false,
      source: 'howcode',
    })
    upsertProjectWorktree({
      cwd: '/repo/.worktrees/feature',
      rootCwd: '/repo',
      branchName: 'feature',
      isMain: false,
      source: 'howcode',
    })

    const row = db
      .prepare('SELECT parent_branch_name AS parentBranchName FROM project_worktrees WHERE cwd = ?')
      .get('/repo/.worktrees/feature') as { parentBranchName: string | null }
    expect(row.parentBranchName).toBe('main')
  })
})
