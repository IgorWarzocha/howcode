import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let userDataPath = ''

async function loadThreadStateDb() {
  return import('./thread-state-db.ts')
}

describe('thread state db branch queries', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(path.join(os.tmpdir(), 'howcode-thread-db-'))
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

  it('lists branch threads across a root project and its worktrees', async () => {
    const { getThreadStateDatabase } = await import('./thread-state-db/db.ts')
    const { listProjectFamilyBranchThreadIds } = await loadThreadStateDb()
    const db = getThreadStateDatabase()

    db.prepare('INSERT INTO projects (cwd, name) VALUES (?, ?)').run('/repo', 'Repo')
    db.prepare('INSERT INTO projects (cwd, name) VALUES (?, ?)').run(
      '/repo/.worktrees/feature',
      'Feature',
    )
    db.prepare(
      `INSERT INTO project_worktrees (cwd, root_cwd, branch_name, is_main, source)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('/repo/.worktrees/feature', '/repo', 'feature', 0, 'howcode')
    const insertThread = db.prepare(
      `INSERT INTO threads (id, cwd, session_path, title, last_modified_ms, branch_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    insertThread.run('root-thread', '/repo', '/sessions/root.jsonl', 'Root', 1, 'feature')
    insertThread.run(
      'worktree-thread',
      '/repo/.worktrees/feature',
      '/sessions/worktree.jsonl',
      'Worktree',
      1,
      'feature',
    )
    insertThread.run('other-branch', '/repo', '/sessions/other.jsonl', 'Other', 1, 'main')

    expect(listProjectFamilyBranchThreadIds('/repo', 'feature')).toEqual([
      'root-thread',
      'worktree-thread',
    ])
  })
})
