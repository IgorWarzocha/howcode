# Worktrees Plan

## Goal

Implement Git worktrees as a first-class workspace concept, using the same source of truth the app already uses for sessions: Pi session JSONL `cwd` values.

The app currently assigns sessions to branches via `threads.branch_name`. With worktrees, the stronger assignment is:

```txt
Pi session JSONL cwd -> threads.cwd -> project/worktree cwd -> sidebar group
```

A session belongs to the cwd where Pi ran. If that cwd is a Git worktree under `./.worktrees/*`, Howcode should keep the session attached to that worktree and render it in the matching worktree group.

## Current relevant code

### Session import already reads cwd

`desktop/pi-threads/session-index.ts` parses the session header:

```ts
type SessionFileEntry = {
  type?: string
  id?: string
  timestamp?: string
  cwd?: string
}
```

`readSessionSummary()` returns `summary.cwd` from the header.

`mapSessionSummaryToRecord(cwd, session)` maps it to a DB record:

```ts
cwd: session.cwd || cwd
```

### Session sync already persists cwd

`desktop/thread-state-db/session-writes.ts` writes:

```sql
INSERT INTO threads (id, cwd, session_path, title, last_modified_ms)
```

So a Pi session created in `/repo/.worktrees/fix-sidebar` can already become:

```sql
threads.cwd = '/repo/.worktrees/fix-sidebar'
```

This is the correct basis for worktree assignment.

Important caveat: JSONL `cwd` is preferred, not guaranteed. The importer still falls back to the shell cwd for older/missing headers, so legacy sessions need to keep working and may need an explicit “move/assign to worktree” action later.

### Current project identity is cwd

`projects.cwd` is the project primary key. Most backend git/runtime/terminal APIs accept `projectId`, and `projectId` is effectively cwd.

This is helpful: each worktree can remain a concrete cwd-backed project while also being grouped under its repo root.

## Design principle

- Pi JSONL `cwd` is the source of truth for session/worktree assignment.
- `threads.cwd` stores the assignment.
- Worktree metadata explains what a project cwd means.
- Sidebar groups by worktree family using DB metadata.
- Git state decorates and reconciles the DB model; Git is not the only UI model source.
- `threads.branch_name` remains useful metadata, but should not be the primary worktree assignment.

## Data model

Add a DB table rather than overloading `projects`:

```sql
CREATE TABLE IF NOT EXISTS project_worktrees (
  cwd TEXT PRIMARY KEY,
  root_cwd TEXT NOT NULL,
  branch_name TEXT,
  is_main INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cwd) REFERENCES projects(cwd) ON DELETE CASCADE,
  FOREIGN KEY (root_cwd) REFERENCES projects(cwd) ON DELETE CASCADE
);
```

Example:

```txt
projects.cwd = /repo
project_worktrees.cwd = /repo
project_worktrees.root_cwd = /repo
project_worktrees.branch_name = main
project_worktrees.is_main = 1

projects.cwd = /repo/.worktrees/fix-sidebar
project_worktrees.cwd = /repo/.worktrees/fix-sidebar
project_worktrees.root_cwd = /repo
project_worktrees.branch_name = fix-sidebar
project_worktrees.is_main = 0

threads.cwd = /repo/.worktrees/fix-sidebar
```

## Shared contract changes

Extend `Project` in `shared/desktop-thread-contracts.ts`:

```ts
export type ProjectWorktreeInfo = {
  rootProjectId: string
  branchName: string | null
  isMain: boolean
}

export type Project = {
  id: string
  name: string
  threads: Thread[]
  worktree?: ProjectWorktreeInfo | undefined
  // existing fields...
}
```

Possibly extend `Thread` later only if the UI needs explicit worktree metadata on threads. Prefer avoiding `threads.worktree_id`; `threads.cwd` already carries the assignment.

## Backend implementation

### 1. Worktree detection helper

Add `desktop/project-git/worktrees.ts`.

Responsibilities:

- Parse `git worktree list --porcelain`.
- Given any cwd, return:
  - current worktree path
  - root/main worktree path
  - branch name
  - whether cwd is main worktree
  - all known worktrees in the family

Useful commands:

```bash
git worktree list --porcelain
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git branch --show-current
```

Important: prefer porcelain parsing for family structure. Use branch commands for current cwd fallback.

### 2. DB writes/queries

Add functions near thread-state DB code, likely new files:

```txt
desktop/thread-state-db/worktree-writes.ts
desktop/thread-state-db/worktree-queries.ts
```

Functions:

```ts
upsertProjectWorktree(input: {
  cwd: string
  rootCwd: string
  branchName: string | null
  isMain: boolean
}): void

clearProjectWorktree(cwd: string): void

listProjectWorktrees(rootCwd: string): ProjectWorktreeRecord[]
```

Update exports in `desktop/thread-state-db.ts` and `desktop/thread-state-db/writes.ts` as needed.

### 3. Persist worktree metadata during session sync

`syncSessionSummaries(cwd, sessions)` is the key translation point.

For each session:

1. Use `session.cwd` from JSONL-derived record.
2. `ensureProject(session.cwd)` / insert project as today.
3. Detect whether `session.cwd` is a git worktree.
4. Upsert `project_worktrees` metadata.
5. Insert/update `threads.cwd = session.cwd` as today.

This makes imported external Pi sessions show under the correct worktree.

Implementation note: `syncSessionSummaries` is currently synchronous. Git detection is async elsewhere. Options:

- Make a sync-safe detector using `execFileSync` for this path, similar to existing sync git usage in `desktop/thread-state-db/schema.ts`.
- Or pre-enrich session records before calling `syncSessionSummaries` in `desktop/pi-threads/shell-index.ts`.

Prefer pre-enrichment if it keeps DB writes simple and testable.

### 4. Persist worktree metadata during live runtime updates

Live thread persistence is not in one place. At least these paths write/upsert thread summaries:

- `desktop/pi-desktop-runtime.ts`
- `desktop/runtime/thread-publisher.ts`
- `desktop/runtime-host/live-thread-publisher.ts`
- `desktop/pi-threads/external-thread-publisher.ts`

`desktop/pi-desktop-runtime.ts` persists runtime-host `thread-update` events with:

```ts
upsertThreadSummary({ cwd: event.projectId, ... })
```

Ensure the same worktree metadata upsert happens for every live/external path that calls `upsertThreadSummary`. Otherwise live sessions may be correct only after a later shell index refresh, or only for one runtime surface.

### 5. Project listing joins worktree metadata

Update `desktop/thread-state-db/queries.ts` `listProjects()` to left join `project_worktrees`.

Update:

- `desktop/thread-state-db/types.ts` `ProjectRow`
- `desktop/thread-state-db/mappers.ts` `mapProjectRow()`
- `shared/desktop-thread-contracts.ts` `Project`

Then renderer receives worktree structure with normal shell state.

## Git worktree actions

Add desktop actions after the data model is in place:

```ts
'workspace.create-worktree'
'workspace.remove-worktree'
'workspace.prune-worktrees'
'workspace.open-worktree'
```

These need the full shared action surface, not just the backend switch:

- `shared/desktop-actions.ts`
- `shared/desktop-action-contracts.ts`
- `shared/desktop-action-coverage.ts`
- matching payload parsing in `shared/pi-thread-action-payloads.ts` if useful
- backend handling in `desktop/pi-threads/workspace-actions.ts`
- coverage expectations in `src/test/desktop-action-coverage.test.ts`

Payload ideas:

```ts
'workspace.create-worktree': {
  projectId?: string | null
  branchName: string
  baseRef?: string | null
}

'workspace.remove-worktree': {
  projectId?: string | null
  worktreePath: string
  force?: boolean
}

'workspace.open-worktree': {
  projectId?: string | null
  worktreePath: string
}
```

Creation convention:

```txt
./.worktrees/*
```

Branch `feature/foo` should map to a safe worktree path. Prefer flattened sanitized folders initially:

```txt
feature/foo -> ./.worktrees/feature-foo
```

Creation flow:

1. Resolve repo root/main worktree.
2. Compute `./.worktrees/<safe-name>` under root.
3. Run `git worktree add`.
4. `ensureProject(worktreePath)`.
5. Upsert `project_worktrees` metadata.
6. Select/open the new worktree project.
7. Optionally start a new thread in that cwd.

Removal should only operate on paths returned by `git worktree list` and preferably under `./.worktrees/*`. Refuse dirty worktrees by default.

Important DB issue: `threads.cwd` has an FK to `projects.cwd` with `ON DELETE CASCADE`. So if removing a worktree project should keep sessions, we cannot delete the project row. We need soft/stale handling, for example:

- keep the `projects` row
- mark the `project_worktrees` row stale/missing, or add a `missing`/`removed` flag later
- render old sessions under a stale worktree group

Do not use existing project deletion paths for worktree removal unless we intentionally want to delete/archive sessions.

## Sidebar model

Build a repo/worktree family model from `Project.worktree`. This is a real sidebar model change, not just a mapper change: current `project-work-*` code is branch-grouped inside each project, and multi-project mode is still project-centric.

```ts
type ProjectWorktreeFamily = {
  root: Project
  worktrees: Project[]
}
```

Rules:

- `worktree.isMain` identifies the root/main row.
- `worktree.rootProjectId` groups child worktrees.
- If a project has no `worktree`, render it as a normal standalone project.
- Threads remain attached to their owning project/worktree cwd.

Sidebar should render something like:

```txt
howcode
  main                  2 sessions
  fix-sidebar           4 sessions dirty
  experiment-parser     1 session
```

Current branch grouping can evolve into worktree grouping. Branch label is display metadata from `project.worktree.branchName` or `ProjectGitState.branch` fallback.

## Session assignment behavior

### Starting a new thread

If the user starts a thread while focused on a worktree project:

```ts
projectId = worktree cwd
```

The runtime should create/update a session whose JSONL cwd is that worktree cwd, and `threads.cwd` remains the worktree cwd.

### Opening a thread

If a thread is under `/repo/.worktrees/fix-sidebar`, opening it must pass:

```ts
projectId: '/repo/.worktrees/fix-sidebar'
sessionPath: thread.sessionPath
```

Composer, terminal, git ops, attachments, and runtime then operate in the same cwd Pi used.

### Assigning old sessions

For sessions without useful cwd, or imported legacy sessions, we can offer explicit “Move to worktree” / “Assign to worktree” actions later. That can update `threads.cwd` to the target worktree project and possibly update `threads.branch_name` metadata.

## Branch assignment compatibility

Keep `threads.branch_name` for now because existing UI and tests depend on it.

When a thread belongs to a worktree, branch display should prefer:

1. `project.worktree.branchName`
2. current `ProjectGitState.branch`
3. `thread.branchName`

Bulk “assign to current branch” in sessions view may need to become “assign to current worktree” or be hidden/renamed in worktree mode.

## Verification targets

Add/adjust tests around:

- `git worktree list --porcelain` parser.
- `mapSessionSummaryToRecord()` cwd behavior, if not already covered.
- DB migration/table creation for `project_worktrees`.
- `listProjects()` mapping `Project.worktree`.
- Sidebar family builder model.
- Opening threads uses the worktree project id/cwd.

## Open questions

1. Should main/root project always get a `project_worktrees` row when it is a git repo, or only after a child worktree exists?
   - Recommendation: yes, add it whenever detected. It simplifies grouping.
2. Should all worktrees be visible as projects by default?
   - Recommendation: yes for created/imported session worktrees. Maybe discovered-but-unused worktrees can appear only in worktree switcher until used.
3. Should removing a worktree archive/delete sessions?
   - Recommendation: no automatic deletion. Keep sessions but mark the project/worktree missing or stale.
4. How much should `workspace.switch-branch` change?
   - Recommendation: after worktrees land, branch switcher should prefer opening/creating worktrees instead of mutating the current cwd.
