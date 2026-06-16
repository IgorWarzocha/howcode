import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.resetModules()
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

  it('treats branch-assigned chat-path sessions as code/worktree threads', async () => {
    const { getChatSessionDir } = await import('./chat-session-dir.ts')
    const { getThreadStateDatabase } = await import('./thread-state-db/db.ts')
    const { listInboxThreads, listProjectThreads } = await loadThreadStateDb()
    const db = getThreadStateDatabase()
    const chatSessionDir = getChatSessionDir()
    const chatSessionPath = path.join(chatSessionDir, 'chat.jsonl')
    const worktreeSessionPath = path.join(chatSessionDir, 'worktree-chat.jsonl')
    const inferredWorktreeSessionPath = path.join(chatSessionDir, 'inferred-worktree-chat.jsonl')

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
    insertThread.run('plain-code', '/repo', '/sessions/code.jsonl', 'Code', 1, null)
    insertThread.run('plain-chat', '/repo', chatSessionPath, 'Chat', 2, null)
    insertThread.run('worktree-chat', '/repo', worktreeSessionPath, 'Worktree chat', 3, 'feature')
    insertThread.run(
      'inferred-worktree-chat',
      '/repo/.worktrees/feature',
      inferredWorktreeSessionPath,
      'Inferred worktree chat',
      4,
      '',
    )
    db.prepare('INSERT INTO chat_threads (session_path, group_id) VALUES (?, ?)').run(
      chatSessionPath,
      null,
    )
    db.prepare('INSERT INTO chat_threads (session_path, group_id) VALUES (?, ?)').run(
      worktreeSessionPath,
      null,
    )
    db.prepare('INSERT INTO chat_threads (session_path, group_id) VALUES (?, ?)').run(
      inferredWorktreeSessionPath,
      null,
    )
    db.prepare(
      `INSERT INTO inbox_items (session_path, unread, last_user_prompt, last_assistant_at_ms)
       VALUES (?, ?, ?, ?)`,
    ).run(worktreeSessionPath, 1, 'Prompt', 4)
    db.prepare(
      `INSERT INTO inbox_items (session_path, unread, last_user_prompt, last_assistant_at_ms)
       VALUES (?, ?, ?, ?)`,
    ).run(inferredWorktreeSessionPath, 1, 'Prompt', 5)

    expect(listProjectThreads('/repo').map((thread) => thread.id)).toEqual([
      'worktree-chat',
      'plain-code',
    ])
    expect(listProjectThreads('/repo', { chat: true }).map((thread) => thread.id)).toEqual([
      'plain-chat',
    ])
    expect(listProjectThreads('/repo/.worktrees/feature').map((thread) => thread.id)).toEqual([
      'inferred-worktree-chat',
    ])
    expect(listInboxThreads()).toMatchObject([
      { threadId: 'inferred-worktree-chat', branchName: 'feature', isChat: true },
      { threadId: 'worktree-chat', branchName: 'feature', isChat: true },
    ])
  })
})
