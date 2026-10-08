import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as Effect from 'effect/Effect'
import * as SqlClient from 'effect/sql/SqlClient'
import { afterEach, describe, expect, it } from 'vitest'
import { repairConversationProjection } from '../../../../desktop/thread-state-db/conversation-projection.ts'
import {
  registerConversationFacts,
  upsertThreadSummary,
} from '../../../../desktop/thread-state-db/conversation-writes.ts'
import { makeThreadStateDatabaseRuntime } from '../../../../desktop/thread-state-db/db.ts'
import {
  dismissInboxThread,
  dismissInboxThreadAfterReply,
  markInboxThreadRead,
} from '../../../../desktop/thread-state-db/inbox-writes.ts'
import {
  archiveThreads,
  deleteThreadRecord,
  renameThreadTitle,
  setThreadDiffPreferences,
} from '../../../../desktop/thread-state-db/thread-writes.ts'
import {
  moveWorkspaceChat,
  reconcileWorkspaceOrganization,
} from '../../../../desktop/thread-state-db/workspace-organization.ts'
import { withDatabaseTransaction } from '../../../../desktop/thread-state-db/write-transaction.ts'
import { artifactsDatabaseSchema } from '../../../artifacts/service/schema.ts'
import { codingDatabaseSchema } from '../schema.ts'
import { deleteProject } from './project-writes.ts'
import {
  hasRetainedProjectFamilyConversations,
  listProjectFamilyConversationIds,
} from './queries.ts'
import {
  registerManagedWorktree,
  setProjectWorktreeCompleted,
  upsertProjectWorktree,
} from './worktree-writes.ts'

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

  const runtime = makeThreadStateDatabaseRuntime(filename, [
    codingDatabaseSchema,
    artifactsDatabaseSchema,
  ])
  fixtures.push({ directory, runtime })
  runtime.runSync(query('SELECT 1'))
  return { filename, runtime }
}

it('preserves moved-out chats and their artifacts across directory workspace removal and restart', async () => {
  const { filename, runtime } = await makeFixture()
  runtime.runSync(query("INSERT INTO chat_groups (id, name) VALUES ('research', 'Research')"))
  for (const conversationId of ['moved', 'stays']) {
    runtime.runSync(
      registerConversationFacts({
        conversationId,
        projectId: '/repo',
        title: conversationId,
        lastModifiedMs: 1,
      }),
    )
    runtime.runSync(
      query(
        'INSERT INTO artifacts (id, conversation_id, kind, content, version) VALUES (?, ?, ?, ?, 1)',
        [conversationId, conversationId, 'markdown', 'Keep'],
      ),
    )
  }
  runtime.runSync(reconcileWorkspaceOrganization([{ id: '/repo', rootId: '/repo', name: 'Repo' }]))
  runtime.runSync(moveWorkspaceChat('moved', 'research'))
  expect(runtime.runSync(hasRetainedProjectFamilyConversations('/repo'))).toBe(true)
  const removedIds = runtime.runSync(listProjectFamilyConversationIds('/repo'))
  expect(removedIds).toEqual(['stays'])
  for (const id of removedIds)
    runtime.runSync(query('DELETE FROM artifacts WHERE conversation_id = ?', [id]))
  runtime.runSync(deleteProject('/repo'))
  await runtime.dispose()
  const reopened = makeThreadStateDatabaseRuntime(filename, [
    codingDatabaseSchema,
    artifactsDatabaseSchema,
  ])
  fixtures[fixtures.length - 1]!.runtime = reopened
  expect(
    reopened.runSync(
      query(
        'SELECT conversation_id AS id, cwd, workspace_id AS workspace, deleted FROM conversation_facts ORDER BY id',
      ),
    ),
  ).toEqual([
    { id: 'moved', cwd: '/repo', workspace: 'research', deleted: 0 },
    { id: 'stays', cwd: '/repo', workspace: 'directory:/repo', deleted: 1 },
  ])
  expect(reopened.runSync(query('SELECT conversation_id AS id, content FROM artifacts'))).toEqual([
    { id: 'moved', content: 'Keep' },
  ])
})

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
  it('retains project facts and deleted spend without importing legacy transcript mirrors', async () => {
    const { runtime } = await makeFixture(createLegacyDatabase)
    expect(
      runtime.runSync(query('SELECT cwd, name, collapsed FROM projects ORDER BY cwd')),
    ).toEqual([
      { cwd: '/legacy-child', name: 'Child name', collapsed: 1 },
      { cwd: '/legacy-root', name: 'Root name', collapsed: 0 },
    ])
    expect(
      runtime.runSync(
        query('SELECT cost_total AS cost, session_count AS count FROM project_usage_totals'),
      ),
    ).toEqual([{ cost: 1.5, count: 7 }])
    expect(
      runtime.runSync(
        query('SELECT source, parent_branch_name AS parent, completed FROM project_worktrees'),
      ),
    ).toEqual([{ source: 'imported', parent: null, completed: 0 }])
    expect(runtime.runSync(query('SELECT COUNT(*) AS count FROM conversation_facts'))).toEqual([
      { count: 0 },
    ])
    expect(
      runtime.runSync(
        query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('threads', 'inbox_items', 'chat_threads')",
        ),
      ),
    ).toEqual([])
  })

  it('enforces foreign keys and cascades thread and artifact dependents', async () => {
    const { runtime } = await makeFixture()

    runtime.runSync(
      execute([
        { statement: `INSERT INTO projects (cwd, name) VALUES ('/project', 'Project')` },
        {
          statement: `
            INSERT INTO conversation_facts (id, cwd, conversation_id, title, last_modified_ms)
            VALUES ('thread-1', '/project', '/sessions/one.jsonl', 'Thread', 1)
          `,
        },
        {
          statement: `INSERT INTO conversation_inbox (conversation_id) VALUES ('/sessions/one.jsonl')`,
        },
        {
          statement: `
            INSERT INTO conversation_reply_suppressions (conversation_id) VALUES ('/sessions/one.jsonl')
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
        conversation_facts: number
      }>(`
        SELECT
          (SELECT COUNT(*) FROM conversation_facts) AS conversation_facts,
          (SELECT COUNT(*) FROM conversation_inbox) AS inboxItems,
          (SELECT COUNT(*) FROM conversation_reply_suppressions) AS suppressions,
          (SELECT COUNT(*) FROM artifact_versions) AS artifactVersions
      `),
    )
    expect(counts).toEqual({
      conversation_facts: 0,
      inboxItems: 0,
      suppressions: 0,
      artifactVersions: 0,
    })
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
      gitCommonDirectoryIdentity: 'git-common-dir-v1:1:2:3',
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

    runtime.runSync(
      registerManagedWorktree({
        ...input,
        gitCommonDirectoryIdentity: 'git-common-dir-v1:9:8:7',
      }),
    )
    expect(
      runtime.runSync(
        query<{ gitCommonDirectoryIdentity: string | null }>(`
          SELECT git_common_dir_identity AS gitCommonDirectoryIdentity
          FROM project_worktrees
          ORDER BY cwd
        `),
      ),
    ).toEqual([
      { gitCommonDirectoryIdentity: input.gitCommonDirectoryIdentity },
      { gitCommonDirectoryIdentity: input.gitCommonDirectoryIdentity },
    ])
  })

  it.each([
    { storedIdentity: null, capturedIdentity: 'git-common-dir-v1:1:2:3' },
    { storedIdentity: 'git-common-dir-v1:1:2:3', capturedIdentity: null },
  ])(
    'preserves worktree lifecycle when either identity is unknown: %j',
    async ({ storedIdentity, capturedIdentity }) => {
      const { runtime } = await makeFixture()
      const input = {
        branchName: 'feature/legacy-provenance',
        gitCommonDirectoryIdentity: storedIdentity,
        parentBranchName: 'main',
        projectId: '/repo-worktrees/legacy-provenance',
        rootProjectId: '/repo',
      }
      runtime.runSync(registerManagedWorktree(input))
      expect(runtime.runSync(setProjectWorktreeCompleted(input.projectId, true))).toBe(true)

      runtime.runSync(
        upsertProjectWorktree({
          cwd: input.projectId,
          rootCwd: input.rootProjectId,
          branchName: input.branchName,
          gitCommonDirectoryIdentity: capturedIdentity,
          isMain: false,
          source: 'howcode',
        }),
      )

      expect(
        runtime.runSync(
          query<{
            completed: number
            gitCommonDirectoryIdentity: string | null
            parentBranchName: string | null
          }>(`
          SELECT
            completed,
            git_common_dir_identity AS gitCommonDirectoryIdentity,
            parent_branch_name AS parentBranchName
          FROM project_worktrees
          WHERE cwd = '/repo-worktrees/legacy-provenance'
        `),
        ),
      ).toEqual([
        {
          completed: 1,
          gitCommonDirectoryIdentity: 'git-common-dir-v1:1:2:3',
          parentBranchName: 'main',
        },
      ])
    },
  )

  it('keeps one sidebar preview and consumes reply suppression once', async () => {
    const { runtime } = await makeFixture()
    runtime.runSync(
      upsertThreadSummary({
        id: '1',
        conversationId: '1',
        cwd: '/repo',
        title: 'Thread',
        lastModifiedMs: 1,
      }),
    )
    runtime.runSync(
      repairConversationProjection({
        conversationId: '1',
        entryId: '2',
        assistantId: '2',
        preview: 'Answer',
        title: 'Question',
        lastModifiedMs: 2,
        running: false,
      }),
    )
    expect(
      runtime.runSync(query('SELECT last_assistant_preview AS preview FROM conversation_facts')),
    ).toEqual([{ preview: 'Answer' }])
    expect(runtime.runSync(query('SELECT unread FROM conversation_inbox'))).toEqual([{ unread: 1 }])
    runtime.runSync(dismissInboxThreadAfterReply('1'))
    runtime.runSync(
      repairConversationProjection({
        conversationId: '1',
        entryId: '3',
        assistantId: '3',
        preview: 'Reply',
        title: 'Question',
        lastModifiedMs: 3,
        running: false,
      }),
    )
    expect(runtime.runSync(query('SELECT unread, dismissed FROM conversation_inbox'))).toEqual([
      { unread: 0, dismissed: 1 },
    ])
    expect(runtime.runSync(query('SELECT * FROM conversation_reply_suppressions'))).toEqual([])
    runtime.runSync(
      repairConversationProjection({
        conversationId: '1',
        entryId: '4',
        assistantId: '4',
        preview: 'Next reply',
        title: 'Question',
        lastModifiedMs: 4,
        running: false,
      }),
    )
    expect(runtime.runSync(query('SELECT unread, dismissed FROM conversation_inbox'))).toEqual([
      { unread: 1, dismissed: 0 },
    ])
  })

  it('preserves app-owned title and branch when repairing summaries', async () => {
    const { runtime } = await makeFixture()
    const conversation = {
      id: '1',
      conversationId: '1',
      cwd: '/repo',
      title: "A title'); DROP TABLE conversation_facts; --",
      branchName: 'feature/original',
      lastModifiedMs: 1,
    }
    runtime.runSync(upsertThreadSummary(conversation))
    runtime.runSync(
      upsertThreadSummary({
        ...conversation,
        title: 'New inferred title',
        branchName: 'feature/new',
        lastModifiedMs: 2,
      }),
    )
    expect(
      runtime.runSync(
        query(
          'SELECT title, branch_name AS branch, last_modified_ms AS modified FROM conversation_facts',
        ),
      ),
    ).toEqual([{ title: conversation.title, branch: 'feature/original', modified: 2 }])
  })

  it('keeps omitted diff preferences and clears only explicitly null values', async () => {
    const { runtime } = await makeFixture()
    const conversationId = "/sessions/it's-a-session.jsonl"
    runtime.runSync(
      upsertThreadSummary({
        id: 'thread-1',
        cwd: '/repo',
        conversationId,
        title: 'Thread',
        lastModifiedMs: 1,
      }),
    )
    const baseline = { kind: 'branch' as const, branchName: "feature/it's-bound" }
    expect(
      runtime.runSync(setThreadDiffPreferences(conversationId, { baseline, renderMode: 'split' })),
    ).toBe(true)
    expect(runtime.runSync(setThreadDiffPreferences(conversationId, { baseline: null }))).toBe(true)
    expect(runtime.runSync(setThreadDiffPreferences(conversationId, {}))).toBe(true)
    const readPreferences = query<{ baseline: string | null; mode: string | null }>(
      'SELECT diff_baseline_json AS baseline, diff_render_mode AS mode FROM conversation_facts WHERE conversation_id = ?',
      [conversationId],
    )
    expect(runtime.runSync(readPreferences)).toEqual([{ baseline: null, mode: 'split' }])
    expect(
      runtime.runSync(setThreadDiffPreferences(conversationId, { baseline, renderMode: null })),
    ).toBe(true)
    expect(runtime.runSync(readPreferences)).toEqual([
      { baseline: JSON.stringify(baseline), mode: null },
    ])
    expect(runtime.runSync(setThreadDiffPreferences('/missing', { baseline }))).toBe(false)
  })

  it('rolls back conversation facts when chat attribution cannot be persisted', async () => {
    const { runtime } = await makeFixture()
    expect(() =>
      runtime.runSync(
        registerConversationFacts({
          conversationId: '1',
          projectId: '/repo',
          title: 'Thread',
          lastModifiedMs: 1,
          isChat: true,
          chatGroupId: 'missing-group',
        }),
      ),
    ).toThrow()
    expect(runtime.runSync(query('SELECT COUNT(*) AS count FROM conversation_facts'))).toEqual([
      { count: 0 },
    ])
    expect(runtime.runSync(query('SELECT COUNT(*) AS count FROM projects'))).toEqual([{ count: 0 }])
    runtime.runSync(
      registerConversationFacts({
        conversationId: '1',
        projectId: '/repo',
        title: 'Thread',
        lastModifiedMs: 1,
        isChat: true,
      }),
    )
    expect(runtime.runSync(query('SELECT conversation_id AS id FROM chat_conversations'))).toEqual([
      { id: '1' },
    ])
  })

  it('repairs projections without changing read, dismissal, title or activity facts', async () => {
    const { runtime } = await makeFixture()
    runtime.runSync(
      upsertThreadSummary({
        id: '1',
        conversationId: '1',
        cwd: '/repo',
        title: 'Initial',
        lastModifiedMs: 1,
      }),
    )
    const projection = {
      conversationId: '1',
      entryId: '2',
      assistantId: '2',
      preview: 'Answer',
      title: 'Derived title',
      lastModifiedMs: 100,
      running: false,
    }
    runtime.runSync(repairConversationProjection(projection))
    runtime.runSync(markInboxThreadRead('1'))
    runtime.runSync(dismissInboxThread('1'))
    runtime.runSync(renameThreadTitle('1', 'Chosen title'))
    runtime.runSync(
      query(
        'UPDATE conversation_facts SET projection_entry_id = NULL, projection_assistant_id = NULL, last_assistant_preview = NULL',
      ),
    )
    runtime.runSync(repairConversationProjection(projection))
    expect(
      runtime.runSync(
        query(
          'SELECT title, last_modified_ms AS activity, last_assistant_preview AS preview FROM conversation_facts',
        ),
      ),
    ).toEqual([{ title: 'Chosen title', activity: 100, preview: 'Answer' }])
    expect(runtime.runSync(query('SELECT unread, dismissed FROM conversation_inbox'))).toEqual([
      { unread: 0, dismissed: 1 },
    ])
    runtime.runSync(
      repairConversationProjection({
        ...projection,
        entryId: '3',
        assistantId: '3',
        lastModifiedMs: 200,
      }),
    )
    expect(runtime.runSync(query('SELECT unread, dismissed FROM conversation_inbox'))).toEqual([
      { unread: 1, dismissed: 0 },
    ])
  })

  it('keeps deletion tombstones and spend attribution through repair and project removal', async () => {
    const { runtime } = await makeFixture()
    runtime.runSync(
      upsertThreadSummary({
        id: '1',
        conversationId: '1',
        cwd: '/repo',
        title: 'Thread',
        lastModifiedMs: 1,
      }),
    )
    runtime.runSync(
      query("INSERT INTO project_usage_totals (cwd, cost_total) VALUES ('/repo', 9.5)"),
    )
    runtime.runSync(deleteThreadRecord('1'))
    runtime.runSync(
      repairConversationProjection({
        conversationId: '1',
        entryId: '2',
        assistantId: '2',
        preview: 'Late result',
        title: 'Derived',
        lastModifiedMs: 200,
        running: true,
      }),
    )
    runtime.runSync(deleteProject('/repo'))
    expect(
      runtime.runSync(
        query('SELECT cwd, deleted, running, last_modified_ms AS activity FROM conversation_facts'),
      ),
    ).toEqual([{ cwd: '/repo', deleted: 1, running: 0, activity: 1 }])
    expect(runtime.runSync(query('SELECT cost_total AS cost FROM project_usage_totals'))).toEqual([
      { cost: 9.5 },
    ])
    expect(runtime.runSync(query('SELECT hidden FROM projects'))).toEqual([{ hidden: 1 }])
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
            INSERT INTO conversation_facts (id, cwd, conversation_id, title, last_modified_ms)
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
          FROM conversation_facts
        `),
      ),
    ).toEqual([{ total: threadCount, archived: threadCount }])
  })
})
