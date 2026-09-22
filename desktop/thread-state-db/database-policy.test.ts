import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/unstable/sql/SqlClient'
import { afterEach, describe, expect, it } from 'vitest'
import { makeThreadStateDatabaseRuntime } from './db.ts'
import {
  consumeInboxReplySuppression,
  dismissInboxThreadAfterReply,
  upsertInboxThreadMessage,
} from './inbox-writes.ts'
import { syncSessionSummaries, upsertThreadSummary } from './session-writes.ts'
import { archiveThreads, setThreadDiffPreferences } from './thread-writes.ts'
import { registerManagedWorktree } from './worktree-writes.ts'
import { withDatabaseTransaction } from './write-transaction.ts'

type TestRuntime = ReturnType<typeof makeThreadStateDatabaseRuntime>

const fixtures: Array<{ directory: string; runtime: TestRuntime }> = []

function query<A extends object>(statement: string, params: readonly unknown[] = []) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql.unsafe<A>(statement, params)
  })
}

function execute(
  statements: readonly { statement: string; params?: readonly unknown[] | undefined }[],
) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    for (const item of statements) {
      yield* sql.unsafe(item.statement, item.params)
    }
  })
}

async function makeFixture(initialize?: (database: DatabaseSync) => void) {
  const directory = await mkdtemp(path.join(tmpdir(), 'howcode-thread-state-db-'))
  const filename = path.join(directory, 'desktop.sqlite')

  if (initialize) {
    const database = new DatabaseSync(filename)
    try {
      initialize(database)
    } finally {
      database.close()
    }
  }

  const runtime = makeThreadStateDatabaseRuntime(filename)
  fixtures.push({ directory, runtime })
  runtime.runSync(query('SELECT 1'))
  return { filename, runtime }
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0).reverse()) {
    await fixture.runtime.dispose()
    await rm(fixture.directory, { recursive: true, force: true })
  }
})

function createLegacyDatabase(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE projects (
      cwd TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      collapsed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      cwd TEXT NOT NULL,
      session_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      running INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      last_modified_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE
    );

    CREATE TABLE inbox_items (
      session_path TEXT PRIMARY KEY,
      unread INTEGER NOT NULL DEFAULT 1,
      last_assistant_message_json TEXT,
      last_assistant_preview TEXT,
      last_assistant_at_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_path) REFERENCES threads(session_path) ON DELETE CASCADE
    );

    CREATE TABLE project_usage_totals (
      cwd TEXT PRIMARY KEY,
      input INTEGER NOT NULL DEFAULT 0,
      output INTEGER NOT NULL DEFAULT 0,
      cache_read INTEGER NOT NULL DEFAULT 0,
      cache_write INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      cost_total REAL NOT NULL DEFAULT 0,
      assistant_turn_count INTEGER NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE project_worktrees (
      cwd TEXT PRIMARY KEY,
      root_cwd TEXT NOT NULL,
      branch_name TEXT,
      is_main INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'howcode',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE,
      FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
    );

    INSERT INTO projects (cwd, name, collapsed)
    VALUES ('/legacy-root', 'Root name', 0), ('/legacy-child', 'Child name', 1);

    INSERT INTO threads (
      id, cwd, session_path, title, running, pinned, archived, last_modified_ms
    ) VALUES ('thread-1', '/legacy-child', '/sessions/one.jsonl', 'Legacy thread', 1, 1, 0, 1234);

    INSERT INTO inbox_items (
      session_path, unread, last_assistant_message_json, last_assistant_preview,
      last_assistant_at_ms
    ) VALUES ('/sessions/one.jsonl', 1, '["legacy"]', 'Legacy preview', 1200);

    INSERT INTO project_usage_totals (
      cwd, input, output, cache_read, cache_write, total_tokens, cost_total,
      assistant_turn_count, session_count
    ) VALUES ('/legacy-root', 1, 2, 3, 4, 10, 1.5, 6, 7);

    INSERT INTO project_worktrees (cwd, root_cwd, branch_name, is_main, source)
    VALUES ('/legacy-child', '/legacy-root', 'feature/legacy', 0, 'imported');
  `)
}

describe('thread state database policy', () => {
  it('migrates legacy rows without losing values and applies migration defaults', async () => {
    const { runtime } = await makeFixture(createLegacyDatabase)

    const [rootProject, childProject] = runtime.runSync(
      query<{
        collapsed: number
        customName: string | null
        gitOpsMode: string | null
        hidden: number
        name: string
        pinned: number
        repoOriginChecked: number
        repoOriginUrl: string | null
      }>(`
        SELECT
          name,
          custom_name AS customName,
          hidden,
          pinned,
          collapsed,
          repo_origin_url AS repoOriginUrl,
          repo_origin_checked AS repoOriginChecked,
          git_ops_mode AS gitOpsMode
        FROM projects
        ORDER BY cwd DESC
      `),
    )
    expect(rootProject).toEqual({
      name: 'Root name',
      customName: null,
      hidden: 0,
      pinned: 0,
      collapsed: 0,
      repoOriginUrl: null,
      repoOriginChecked: 0,
      gitOpsMode: null,
    })
    expect(childProject).toMatchObject({ name: 'Child name', collapsed: 1 })

    expect(
      runtime.runSync(
        query<{
          archived: number
          branchName: string | null
          diffBaselineJson: string | null
          diffRenderMode: string | null
          id: string
          lastAssistantAtMs: number | null
          lastAssistantMessageJson: string | null
          lastAssistantPreview: string | null
          lastModifiedMs: number
          pinned: number
          running: number
          title: string
        }>(`
          SELECT
            id, title, running, pinned, archived, last_modified_ms AS lastModifiedMs,
            last_assistant_message_json AS lastAssistantMessageJson,
            last_assistant_preview AS lastAssistantPreview,
            last_assistant_at_ms AS lastAssistantAtMs,
            branch_name AS branchName, diff_baseline_json AS diffBaselineJson,
            diff_render_mode AS diffRenderMode
          FROM threads
        `),
      )[0],
    ).toEqual({
      id: 'thread-1',
      title: 'Legacy thread',
      running: 0,
      pinned: 1,
      archived: 0,
      lastModifiedMs: 1234,
      lastAssistantMessageJson: null,
      lastAssistantPreview: null,
      lastAssistantAtMs: null,
      branchName: null,
      diffBaselineJson: null,
      diffRenderMode: null,
    })

    expect(
      runtime.runSync(
        query<{
          lastAssistantAtMs: number
          lastAssistantMessageJson: string
          lastAssistantPreview: string
          lastUserPrompt: string | null
          unread: number
        }>(`
          SELECT
            unread, last_user_prompt AS lastUserPrompt,
            last_assistant_message_json AS lastAssistantMessageJson,
            last_assistant_preview AS lastAssistantPreview,
            last_assistant_at_ms AS lastAssistantAtMs
          FROM inbox_items
        `),
      )[0],
    ).toEqual({
      unread: 1,
      lastUserPrompt: null,
      lastAssistantMessageJson: '["legacy"]',
      lastAssistantPreview: 'Legacy preview',
      lastAssistantAtMs: 1200,
    })

    expect(
      runtime.runSync(
        query<{
          assistantTurnCount: number
          cacheRead: number
          cacheWrite: number
          costTotal: number
          input: number
          output: number
          sessionCount: number
          sessionsWithUsageCount: number
          totalTokens: number
        }>(`
          SELECT
            input, output, cache_read AS cacheRead, cache_write AS cacheWrite,
            total_tokens AS totalTokens, cost_total AS costTotal,
            assistant_turn_count AS assistantTurnCount, session_count AS sessionCount,
            sessions_with_usage_count AS sessionsWithUsageCount
          FROM project_usage_totals
        `),
      )[0],
    ).toEqual({
      input: 1,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
      totalTokens: 10,
      costTotal: 1.5,
      assistantTurnCount: 6,
      sessionCount: 7,
      sessionsWithUsageCount: 0,
    })

    expect(
      runtime.runSync(
        query<{
          branchName: string
          completed: number
          cwd: string
          isMain: number
          parentBranchName: string | null
          rootCwd: string
          source: string
        }>(`
          SELECT
            cwd, root_cwd AS rootCwd, branch_name AS branchName,
            parent_branch_name AS parentBranchName, is_main AS isMain, source, completed
          FROM project_worktrees
        `),
      )[0],
    ).toEqual({
      cwd: '/legacy-child',
      rootCwd: '/legacy-root',
      branchName: 'feature/legacy',
      parentBranchName: null,
      isMain: 0,
      source: 'imported',
      completed: 0,
    })
  })

  it('enforces foreign keys and cascades thread and artifact dependents', async () => {
    const { runtime } = await makeFixture()

    runtime.runSync(
      execute([
        { statement: `INSERT INTO projects (cwd, name) VALUES ('/project', 'Project')` },
        {
          statement: `
            INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
            VALUES ('thread-1', '/project', '/sessions/one.jsonl', 'Thread', 1)
          `,
        },
        {
          statement: `INSERT INTO inbox_items (session_path) VALUES ('/sessions/one.jsonl')`,
        },
        {
          statement: `
            INSERT INTO inbox_reply_suppressions (session_path) VALUES ('/sessions/one.jsonl')
          `,
        },
        {
          statement: `
            INSERT INTO artifacts (id, conversation_id, kind, content, version)
            VALUES ('artifact-1', 'thread-1', 'markdown', '# One', 1)
          `,
        },
        {
          statement: `
            INSERT INTO artifact_versions (artifact_id, version, content)
            VALUES ('artifact-1', 1, '# One')
          `,
        },
      ]),
    )

    expect(() =>
      runtime.runSync(
        query('INSERT INTO artifact_versions (artifact_id, version, content) VALUES (?, 1, ?)', [
          'missing-artifact',
          'orphan',
        ]),
      ),
    ).toThrow()

    runtime.runSync(query(`DELETE FROM projects WHERE cwd = '/project'`))
    runtime.runSync(query(`DELETE FROM artifacts WHERE id = 'artifact-1'`))

    const [counts] = runtime.runSync(
      query<{
        artifactVersions: number
        inboxItems: number
        suppressions: number
        threads: number
      }>(`
        SELECT
          (SELECT COUNT(*) FROM threads) AS threads,
          (SELECT COUNT(*) FROM inbox_items) AS inboxItems,
          (SELECT COUNT(*) FROM inbox_reply_suppressions) AS suppressions,
          (SELECT COUNT(*) FROM artifact_versions) AS artifactVersions
      `),
    )
    expect(counts).toEqual({ threads: 0, inboxItems: 0, suppressions: 0, artifactVersions: 0 })
  })

  it('keeps read-only transactions deferred while another WAL connection owns the write lock', async () => {
    const { filename, runtime } = await makeFixture()
    const writer = new DatabaseSync(filename, { timeout: 0 })
    try {
      writer.exec('PRAGMA journal_mode = WAL')
      writer.exec('BEGIN IMMEDIATE')
      const rows = runtime.runSync(
        withDatabaseTransaction(query<{ answer: number }>('SELECT 42 AS answer')),
      )
      expect(rows).toEqual([{ answer: 42 }])
    } finally {
      if (writer.isTransaction) writer.exec('ROLLBACK')
      writer.close()
    }
  }, 7_000)

  it('rolls back managed worktree registration on a constraint and recovers the connection', async () => {
    const { runtime } = await makeFixture()
    runtime.runSync(
      query(`
        CREATE TRIGGER reject_managed_child
        BEFORE INSERT ON project_worktrees
        WHEN NEW.is_main = 0
        BEGIN
          SELECT RAISE(ABORT, 'test managed worktree constraint');
        END;
      `),
    )

    const input = {
      branchName: 'feature/atomic',
      parentBranchName: 'main',
      projectId: '/repo-worktrees/feature-atomic',
      rootProjectId: '/repo',
    }
    expect(() => runtime.runSync(registerManagedWorktree(input))).toThrow()

    const [rolledBack] = runtime.runSync(
      query<{ projects: number; worktrees: number }>(`
        SELECT
          (SELECT COUNT(*) FROM projects) AS projects,
          (SELECT COUNT(*) FROM project_worktrees) AS worktrees
      `),
    )
    expect(rolledBack).toEqual({ projects: 0, worktrees: 0 })

    runtime.runSync(query('DROP TRIGGER reject_managed_child'))
    runtime.runSync(registerManagedWorktree(input))

    const [recovered] = runtime.runSync(
      query<{ projects: number; worktrees: number }>(`
        SELECT
          (SELECT COUNT(*) FROM projects) AS projects,
          (SELECT COUNT(*) FROM project_worktrees) AS worktrees
      `),
    )
    expect(recovered).toEqual({ projects: 2, worktrees: 2 })
  })

  it('updates both message snapshots synchronously and consumes reply suppression once', async () => {
    const { runtime } = await makeFixture()
    const sessionPath = '/sessions/inbox.jsonl'

    runtime.runSync(
      execute([
        { statement: `INSERT INTO projects (cwd, name) VALUES ('/project', 'Project')` },
        {
          statement: `
            INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
            VALUES ('thread-1', '/project', ?, 'Inbox thread', 1)
          `,
          params: [sessionPath],
        },
      ]),
    )
    runtime.runSync(
      upsertInboxThreadMessage({
        sessionPath,
        userPrompt: 'First prompt',
        content: ['First answer'],
        preview: 'First preview',
        lastAssistantAtMs: 10,
      }),
    )

    const [snapshots] = runtime.runSync(
      query<{
        inboxMessage: string
        inboxPreview: string
        threadMessage: string
        threadPreview: string
      }>(
        `
          SELECT
            inbox_items.last_assistant_message_json AS inboxMessage,
            inbox_items.last_assistant_preview AS inboxPreview,
            threads.last_assistant_message_json AS threadMessage,
            threads.last_assistant_preview AS threadPreview
          FROM threads
          INNER JOIN inbox_items ON inbox_items.session_path = threads.session_path
          WHERE threads.session_path = ?
        `,
        [sessionPath],
      ),
    )
    expect(snapshots).toEqual({
      inboxMessage: '["First answer"]',
      inboxPreview: 'First preview',
      threadMessage: '["First answer"]',
      threadPreview: 'First preview',
    })

    runtime.runSync(dismissInboxThreadAfterReply(sessionPath))
    runtime.runSync(
      upsertInboxThreadMessage({
        sessionPath,
        userPrompt: 'Suppressed prompt',
        content: ['Suppressed answer'],
        preview: 'Suppressed preview',
        lastAssistantAtMs: 20,
      }),
    )
    expect(runtime.runSync(consumeInboxReplySuppression(sessionPath))).toBe(true)
    expect(
      runtime.runSync(
        query<{ count: number }>(
          'SELECT COUNT(*) AS count FROM inbox_items WHERE session_path = ?',
          [sessionPath],
        ),
      )[0]?.count,
    ).toBe(0)

    runtime.runSync(
      upsertInboxThreadMessage({
        sessionPath,
        userPrompt: 'Kept prompt',
        content: ['Kept answer'],
        preview: 'Kept preview',
        lastAssistantAtMs: 30,
      }),
    )
    expect(runtime.runSync(consumeInboxReplySuppression(sessionPath))).toBe(false)
    expect(
      runtime.runSync(
        query<{ preview: string }>(
          'SELECT last_assistant_preview AS preview FROM inbox_items WHERE session_path = ?',
          [sessionPath],
        ),
      ),
    ).toEqual([{ preview: 'Kept preview' }])
  })

  it('preserves stored branch attribution when later session scans disagree', async () => {
    const { runtime } = await makeFixture()
    runtime.runSync(
      registerManagedWorktree({
        rootProjectId: '/repo',
        projectId: '/worktree',
        branchName: 'feature/worktree',
        parentBranchName: 'main',
      }),
    )
    const session = {
      id: 'thread-1',
      cwd: '/worktree',
      sessionPath: "/sessions/it's-a-session.jsonl",
      title: "A title'); DROP TABLE threads; --",
      lastModifiedMs: 1,
    }
    runtime.runSync(upsertThreadSummary(session))
    runtime.runSync(
      syncSessionSummaries('/worktree', [
        { ...session, branchName: 'feature/new-scan', lastModifiedMs: 2 },
        { ...session, id: 'thread-2', sessionPath: '/sessions/two.jsonl', branchName: 'explicit' },
      ]),
    )
    expect(
      runtime.runSync(
        query<{ branch: string; title: string; modified: number }>(
          'SELECT branch_name AS branch, title, last_modified_ms AS modified FROM threads ORDER BY id',
        ),
      ),
    ).toEqual([
      { branch: 'feature/worktree', title: session.title, modified: 2 },
      { branch: 'explicit', title: session.title, modified: 1 },
    ])
  })

  it('keeps omitted diff preferences and clears only explicitly null values', async () => {
    const { runtime } = await makeFixture()
    const sessionPath = "/sessions/it's-a-session.jsonl"
    runtime.runSync(
      upsertThreadSummary({
        id: 'thread-1',
        cwd: '/repo',
        sessionPath,
        title: 'Thread',
        lastModifiedMs: 1,
      }),
    )
    const baseline = { kind: 'branch' as const, branchName: "feature/it's-bound" }
    expect(
      runtime.runSync(setThreadDiffPreferences(sessionPath, { baseline, renderMode: 'split' })),
    ).toBe(true)
    expect(runtime.runSync(setThreadDiffPreferences(sessionPath, { baseline: null }))).toBe(true)
    expect(runtime.runSync(setThreadDiffPreferences(sessionPath, {}))).toBe(true)
    const readPreferences = query<{ baseline: string | null; mode: string | null }>(
      'SELECT diff_baseline_json AS baseline, diff_render_mode AS mode FROM threads WHERE session_path = ?',
      [sessionPath],
    )
    expect(runtime.runSync(readPreferences)).toEqual([{ baseline: null, mode: 'split' }])
    expect(
      runtime.runSync(setThreadDiffPreferences(sessionPath, { baseline, renderMode: null })),
    ).toBe(true)
    expect(runtime.runSync(readPreferences)).toEqual([
      { baseline: JSON.stringify(baseline), mode: null },
    ])
    expect(runtime.runSync(setThreadDiffPreferences('/missing', { baseline }))).toBe(false)
  })

  it('finishes large grouped writes before the synchronous runtime call returns', async () => {
    const { runtime } = await makeFixture()
    const threadCount = 1_200
    const threadIds = Array.from({ length: threadCount }, (_, index) => `thread-${index}`)

    runtime.runSync(
      execute([
        { statement: `INSERT INTO projects (cwd, name) VALUES ('/batch', 'Batch')` },
        {
          statement: `
            WITH RECURSIVE sequence(value) AS (
              SELECT 0
              UNION ALL
              SELECT value + 1 FROM sequence WHERE value + 1 < ?
            )
            INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
            SELECT
              'thread-' || value,
              '/batch',
              '/sessions/' || value || '.jsonl',
              'Thread ' || value,
              value
            FROM sequence
          `,
          params: [threadCount],
        },
      ]),
    )

    runtime.runSync(archiveThreads(threadIds))

    expect(
      runtime.runSync(
        query<{ archived: number; total: number }>(`
          SELECT COUNT(*) AS total, SUM(archived) AS archived
          FROM threads
        `),
      ),
    ).toEqual([{ total: threadCount, archived: threadCount }])
  })
})
