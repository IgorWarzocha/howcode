# Effect in Howcode

Howcode uses Effect for application infrastructure. Pi Durable owns agent execution and conversation persistence. These are separate responsibilities, not competing runtimes.

## What Effect owns

- **Terminals:** scoped sessions, shared concurrent opens, restart ownership, ordered transcript writes, event streams and schema-backed RPC. See `desktop/terminal/` and `shared/terminal-rpc.ts`.
- **Backend process supervision:** startup coordination, pending requests and shutdown in `src/desktop-host/desktop-service/`.
- **Workspace operations:** independent keyed locks and draining accepted work in `desktop/runtime/keyed-workspace-operations.ts`. Workspace admission policy remains in `desktop/project-worktrees/workspace-teardown-gate.ts`.
- **App persistence:** the SQLite runtime, queries and transactions in `desktop/thread-state-db/`. This database holds Howcode state, not a second copy of Durable's conversation history.
- **Validation:** schemas for transport messages, settings and persisted rows.
- **Attachment search:** bounded caching and shared index construction in `src/desktop-host/composer-attachment-search.ts`.

## Boundaries worth keeping

Use Effect where it replaces concurrency, resource or failure-management machinery. Keep native filesystem, PTY and SDK adapters narrow. Convert to promises at external boundaries rather than repeatedly inside an operation.

Durable's Harness owns agent execution, scheduling and its storage. Do not recreate those responsibilities with Effect AI, Workflow or a parallel runtime registry. Renderer state remains owned by React and TanStack Query.

Resource cleanup is not permission to abandon accepted writes. Terminal transcripts and workspace mutations must drain before their resources close. Interruptible refresh work has a different policy.

Keyed workspace locks use `RcMap` entries containing individual semaphores. A single partitioned semaphore would share one permit pool and unnecessarily serialize unrelated work. Cross-process filesystem leases still need cross-process coordination.

The SQLite adapter uses stock `node:sqlite`. Public database operations remain synchronous to preserve same-turn ordering. `write-transaction.ts` retains deferred `BEGIN`, rollback and nested savepoints rather than adopting the driver's default `BEGIN IMMEDIATE`. WAL, foreign keys and the busy timeout remain application requirements.

## Version and maintenance

`effect` and `@effect/sql-sqlite-node` are pinned together at **4.0.1**. Stable v4 removed the `effect/unstable/` import prefix. SQL and RPC now live under `effect/sql/` and `effect/rpc/`, but those APIs still carry upstream unstable annotations.

Upgrade checks must cover our concurrency, transaction, RPC and shutdown contracts, not just successful compilation. Keep Effect adoption tied to an actual simplification. More imports are not a measure of better integration.
