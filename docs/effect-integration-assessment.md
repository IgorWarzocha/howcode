# Effect v4 integration assessment

20 September 2026. Reviewed against `effect@4.0.0-rc.116` on `chore/effect-pi-dependency-refresh`.

## Verdict

Howcode already uses Effect for substantial runtime work, not just schemas around Promise code. Runtime-host creation, recovery, terminal RPC, shutdown, and live-runtime disposal have real Effect ownership. But the previous migration left a second layer of handwritten queues, timers, in-flight maps, and locks around those services.

This branch removes the local coordination identified below. It does **not** make the whole application Effect-native. SQLite, ordinary filesystem and process adapters, the headless HTTP server, and renderer state remain separate integration opportunities. Some custom code is also necessary: workspace admission rules, filesystem leases, optimistic file revisions, and Pi session identity cannot be replaced by choosing a similarly named primitive.

There is no useful single “percentage integrated”. An import count treats a schema decoder and a scoped runtime supervisor as equivalent; they are not.

## How this was assessed

- Read the [v4 API catalogue](https://effect.website/docs/v4/api) in the browser, including the core and unstable module families and the relevant platform packages.
- Read reference contracts and examples for the candidate primitives, then traced their actual Howcode owners and callers. Checked the installed rc.116 source where exact behaviour mattered.
- Distinguished a native boundary adapter from orchestration that Effect can own. Also distinguished resource lifetime from value caching, and domain state from library bookkeeping.
- Read selected APIs in depth, not every export of every module. The core package catalogue contained 353 modules; that is the search space, not a claim that all 353 received a line-by-line audit.
- The website source links referenced commit `d62dd0d65252e5d3635538f0e41adc7c08aa9beb`. Installed package types and source remain authoritative for this branch when the moving website differs.

## Integration already present

| Area | Evidence | Assessment |
| --- | --- | --- |
| Runtime registry | `desktop/runtime-host/live-runtime-registry-core.ts`, `live-runtime-registry.ts`, `live-runtime-updates.ts` | Scoped acquisition, Deferred creation results, state transitions, disposal and scheduled idle work are real integration. The registry itself is domain state, not an accidental cache. |
| Desktop-service supervision | `src/desktop-host/desktop-service/core.ts`, `live-process.ts` | Effect owns the service/process lifetime and recovery. Native child-process IPC remains an adapter underneath it. |
| Runtime-host broker | `desktop/runtime-host/broker/core.ts` | Host ownership and shutdown are coordinated through Effect rather than unrelated Promise callers. |
| Terminal service and events | `desktop/terminal/service.ts`, `session-store.ts`, `rpc-server.ts`; `shared/terminal-rpc.ts` | Layer/service wiring, child scopes, PubSub/Stream events and schema-backed RPC are integrated. The imperative engine still needed the changes below. |
| Shutdown | `shared/effect-shutdown.ts`, `desktop/service-host-runtime.ts` | Shared, bounded shutdown coordination already exists. Resource finalizers must still settle their own work; wrapping shutdown does not make detached work safe. |
| External and persisted data | `shared/*-schema.ts`, `desktop/pi-threads/session-entry-schema.ts`, database row readers | Schema decoding is useful integration at ingress. It does not, by itself, make the underlying storage or transport an Effect service. |

## Changes made on this branch

| Previous handwritten mechanism | Replacement and owner | Behaviour retained |
| --- | --- | --- |
| Attachment-index Map, expiry and pruning | Bounded `Cache` in `src/desktop-host/composer-attachment-search.ts` | Canonical-root keys; shared concurrent walks; 30-second snapshots; eight retained roots; existing 50,000-entry traversal cap, ranking and partial-directory policy. |
| Registry lock maps and manual reference counts | Two scoped `RcMap` collections of one-permit semaphores in `desktop/runtime-host/live-runtime-registry-state.ts` | Separate lifecycle and mutation lock spaces; unrelated runtime keys remain independent. |
| Terminal-opening Promise map | Scoped `FiberMap` in `desktop/terminal/manager.ts` | Concurrent opens share their result. Pending opens drain before the child session scope closes. |
| Terminal-restart Promise field | Scoped `FiberHandle` in `desktop/terminal/session-lifecycle.ts` | One active spawn per record; late PTYs remain owned until termination finishes. Failed late termination is reported rather than silently treated as success. |
| Transcript Promise tail and timer | `Queue`, `Deferred`, a scoped stream consumer and a debounce `FiberHandle` in `desktop/terminal/session-history.ts` | Ordered asynchronous writes and moves; final snapshot flush and queue drain on close. Clears now join the same queue, so an earlier write cannot resurrect cleared history. |
| Selected-session watcher globals, token and timer | Scoped watcher acquisition, `FiberHandle`, sliding queue and `Stream.debounce` in `desktop/pi-threads/session-watch.ts` | 140 ms debounce, mtime checks and internal-update suppression. Replacing the selection interrupts obsolete acquisition/refresh work and closes its watcher. |
| TUI-detection timer and in-flight Promise | Separate scoped scheduling and binding `FiberHandle`s in `desktop/terminal/tui-session-detection.ts` | 180 ms prompt debounce, 700 ms retries, detection age and prompt matching; scans do not overlap and an active scan drains when stopped. |
| Shell-index in-flight Promise map | Scoped `FiberMap` in `desktop/pi-threads/shell-index.ts` | Ordinary callers share a scan. Forced callers wait for the old scan and share one subsequent fresh pass. Partial scans remain retryable. |
| Desktop thread-update Promise tails | `RcMap` locks plus scoped `FiberSet` in `desktop/runtime/thread-update-forwarding.ts` | Per-session persistence precedes forwarding; other sessions proceed independently; failed updates do not wedge later ones. Accepted updates drain during shutdown. |
| Root Git, file-write and snapshot Promise tails | Shared scoped keyed-operation owner in `desktop/runtime/keyed-workspace-operations.ts` | Independent lock namespaces; canonical identity where previously used; operation errors reach their callers without poisoning queue bookkeeping. Filesystem locking and file-write security checks stay in their original owners. |
| Workspace-admission tail and idle resolver | `Semaphore` and `Deferred` in `desktop/project-worktrees/workspace-teardown-gate.ts` | Teardown blocks new admission, waits for accepted activity, and retains canonical workspace identity. Active-operation counts and teardown state remain domain policy. |
| Session-scan worker pool | Bounded `Effect.forEach` in `desktop/pi-threads/map-with-concurrency.ts` | Input-order results and caller-specified parallelism. Invalid bounds fail before work starts; admitted operations settle before a failed traversal returns. |
| Updater retry loop | `Effect.retry` with exponential `Schedule` in `src/electron/main/updater/update-transport.ts` | Three attempts, 500/1,000 ms waits, and the existing every-error retry policy. Downloads still overwrite their destination on each attempt. |
| Headless startup cleanup gap | Failure cleanup in `src/electron/main/headless/server.ts` | The existing HTTP/SSE protocol stays unchanged. A failed port bind now releases startup subscriptions. |

The Promise-facing APIs remain where callers and external SDKs require them. The difference is that shared work, serialisation and cleanup are now owned below those boundaries, rather than reconstructed by Promise tails. Attachment search also resolves symlink metadata with bounded parallelism while retaining directory order for traversal limits and ranking.

## Important API distinctions

### Keyed locks are not partitioned permits

[`PartitionedSemaphore`](https://effect.website/docs/v4/api/effect/PartitionedSemaphore) shares one permit pool fairly across partition keys. It is not an independent mutex for each key. Replacing a keyed lock map with a one-permit PartitionedSemaphore would serialise unrelated sessions and projects.

[`RcMap`](https://effect.website/docs/v4/api/effect/RcMap) is the correct fit here: each retained key owns a semaphore, and both waiters and holders retain its scope. With no idle TTL, an unused lock entry can disappear immediately.

### A busy Pi runtime is not a cached value

[`Cache`](https://effect.website/docs/v4/api/effect/Cache) fits attachment indexes. [`ScopedCache`](https://effect.website/docs/v4/api/effect/ScopedCache) owns resources, but eviction can close a resource independently of an ongoing request's lifetime. Neither can simply replace the live-runtime registry.

The registry must understand streaming, pending dialogs, settings directories, stale generations, creation identity and identity-safe disposal. [`LayerMap`](https://effect.website/docs/v4/api/effect/LayerMap) can manage keyed service contexts; it does not supply those rules. Keeping that domain state is deliberate, not a missed integration.

### Cancellation and draining are different policies

[`FiberMap`](https://effect.website/docs/v4/api/effect/FiberMap), [`FiberHandle`](https://effect.website/docs/v4/api/effect/FiberHandle) and [`FiberSet`](https://effect.website/docs/v4/api/effect/FiberSet) supply ownership and automatic removal. Their default interruption on scope closure is not permission to abandon persistence.

The new owners stop admission and drain accepted mutations before closing resources. Watch refreshes can be interrupted; transcript writes and accepted thread updates must settle. The existing outer shutdown deadline remains the process-wide bound.

The installed `FiberMap.run(..., { onlyIfMissing: true })` does not join an existing result: it returns an interrupted new fiber when a key exists. Result-sharing callers explicitly look up and join the existing fiber instead.

[`Stream.fromEventListener`](https://effect.website/docs/v4/api/effect/Stream) expects an EventTarget-style interface, not Node's `.on/.off` API. Node watcher callbacks still need an adapter. Debouncing also does not provide a final persistence flush by itself.

## Remaining opportunities and deliberate boundaries

### SQLite: a separate persistence migration

**Decision: document separately; do not migrate SQLite on this branch.**

[`SqlClient`](https://effect.website/docs/v4/api/effect/unstable/sql/SqlClient) provides effectful queries and transaction ownership. [`@effect/sql-sqlite-node`](https://effect.website/docs/v4/api/sql-sqlite-node/SqliteClient) uses stock `node:sqlite`, not `better-sqlite3`. This could remove one native dependency and its ABI packaging burden.

It is not a drop-in import change. `desktop/thread-state-db/db.ts`, `desktop/thread-state-db/write-transaction.ts` and their repository callers currently expose synchronous database work. The adapter also brings connection serialisation, statement caching, WAL configuration, a blocking busy timeout and `BEGIN IMMEDIATE` for write transactions. Those choices must be compared with the current transaction and contention policy.

A useful next pass would migrate one repository boundary first, verify rollback and concurrent-writer behaviour, then validate all supported stock-Node and packaged-platform combinations before removing `better-sqlite3`.

### Filesystem and child processes

[`FileSystem`](https://effect.website/docs/v4/api/effect/FileSystem) and [`NodeServices`](https://effect.website/docs/v4/api/platform-node/NodeServices) could make filesystem dependencies injectable. They do not replace path containment, symlink rejection, optimistic revision checks, fsync or atomic rename in `desktop/project-git/file-write.ts`.

`FileSystem.readDirectory` returns names rather than Node Dirents. A mechanical attachment-walker port could add stat calls rather than optimise it. Keep the current adapter until an Effect filesystem service has a concrete ownership or testability benefit.

[`ChildProcess`](https://effect.website/docs/v4/api/effect/unstable/process/ChildProcess) and [`ChildProcessSpawner`](https://effect.website/docs/v4/api/effect/unstable/process/ChildProcessSpawner) are credible next integrations for `node-runtime/process-probe.ts` and `desktop/project-git/git-runner.ts`. Preserve byte caps, timeout policy, abort signals, environment and cleanup when doing that work.

They are not a replacement for Node child-process `.send()`/`message` IPC or PTY resize/kill semantics. Those native adapters remain necessary. Likewise, the mkdir-based cross-process lease in `desktop/project-git/worktree-snapshot.ts` is still necessary; an in-memory RcMap cannot coordinate another process. Its stale-lock, polling and timeout policy was not replaced by a local mutex.

### HTTP, RPC and stream encoding

[`HttpClient`](https://effect.website/docs/v4/api/effect/unstable/http/HttpClient) can centralise request configuration, status classification, decoding and cancellation for updater/catalog/download adapters. This branch integrates updater retry scheduling, **not** the whole HTTP client.

`filterStatusOk` must be explicit. `retryTransient` is not behaviour-equivalent to the updater's current retry-on-every-error policy: it selects transport/timeouts and specific HTTP statuses. Tightening that policy should be a deliberate change, not an accidental dependency optimisation.

[`HttpApi`](https://effect.website/docs/v4/api/effect/unstable/httpapi/HttpApi) could own the headless API, while Effect RPC could replace more of the custom desktop-service protocol. That would require preserving host/origin trust, authentication, cookies, upload limits, SSE subscriptions and shared wire contracts. The current terminal RPC migration already uses Effect's schema-encoded messages; rc.116's protocol codec requirements are implemented on both ends.

[`Sse`](https://effect.website/docs/v4/api/effect/unstable/encoding/Sse) and [`Ndjson`](https://effect.website/docs/v4/api/effect/unstable/encoding/Ndjson) are real encoding tools, not merely index entries. NDJSON's decoder fails on malformed records; Howcode's session reader intentionally skips malformed/partial lines independently. A direct decoder swap would lose that recovery policy. Browser EventSource and Pi-owned streams also do not need a parallel parser without a concrete requirement.

### Caches, configuration, telemetry and React

- `desktop/pi-threads/project-usage-summary.ts` still has bounded signature-based and stale-while-refresh caches. Their keys, invalidation and refresh semantics differ from a plain TTL cache; they need a dedicated cache design, not the attachment-cache recipe copied across.
- [`KeyValueStore`](https://effect.website/docs/v4/api/effect/unstable/persistence/KeyValueStore) is not a substitute for relational SQLite data or the updater's atomic JSON files. Its filesystem layer has encoded-key, filename and directory-clear semantics of its own.
- [`ConfigProvider`](https://effect.website/docs/v4/api/effect/ConfigProvider) and Config recipes can consolidate startup configuration. Preserve empty-string and malformed-value policy: the environment provider's defaults are not automatically identical to existing environment parsing.
- [`Otlp`](https://effect.website/docs/v4/api/effect/unstable/observability/Otlp) is available, but exporting telemetry needs an endpoint and an explicit privacy/product decision. Nothing starts sending telemetry on this branch.
- [`Atom`](https://effect.website/docs/v4/api/effect/unstable/reactivity/Atom) and [`@effect/atom-react` hooks](https://effect.website/docs/v4/api/atom-react/Hooks) manage reactive values and their lifetimes. Howcode already has TanStack Query and renderer state ownership. Adding an Atom cache beside them would create two owners; replacing them is a renderer architecture decision, not a dependency-refresh optimisation.
- Effect's TestClock and synchronisation primitives cover the new timing/concurrency contracts under the existing Vitest runner. Adding another test integration package is not necessary just to rename test declarations.

### Broader API families screened

Read the overviews for LanguageModel, Worker, Workflow, Sharding, EventLog, Command and Socket after screening their catalogue families. They are architectural alternatives, not missing imports:

- Effect AI would change the provider/agent boundary currently owned by Pi.
- Workflow, Cluster and EventLog introduce durable execution, distributed routing or journal semantics that the local runtime registry does not require.
- Worker provides scoped worker transport; it does not erase the need for the separate stock-Node service and native dependency boundary.
- CLI and Socket should be adopted when their parsing/connection ownership replaces a real application requirement, not alongside an existing owner merely to increase Effect coverage.

## Dependency changes and useful removals

- Pi is pinned to **0.86.1** across all four direct packages. Added its global prompt-cache warming control, with the upstream `streaming` default and an explicit warning that warming can make metered requests.
- Session usage accounting now includes standalone usage, compaction, branch-summary and tool-result usage. Live summaries and the ledger retained after deletion use the same reader; non-assistant usage does not inflate assistant-turn counts.
- Electron **44.4.3** supplies native clipboard file/image APIs. Removed `clip-filepaths`; URI-list parsing retains malformed-entry isolation and rejects invalid local paths. Removed the custom ZIP installer after verifying the upstream installer and packaged build.
- Pierre Diffs **1.4.3** requires the new editor factory and edit-event API. Review anchors still update during editing, but their remapped annotations are not echoed back into Pierre's active controlled item. Workspace writes and refreshed project diffs remain authoritative.
- React/DOM **19.3.0**, Vite **8.3**, Vitest **5.0.1**, Biome **2.5.14** and the remaining direct dependencies were refreshed. Removed unused direct TypeBox/Three types and stale/redundant overrides rather than retaining upgrade debris.
- No new UI/state framework, telemetry exporter, SQL driver or platform package was added speculatively. ASAR stays enabled; the stock-Node backend and its complete native dependency trees remain outside it.

## Validation boundary

Focused checks cover cache deduplication/expiry/eviction, lock isolation/interruption, forced-refresh concurrency, watcher replacement, ordered persistence and draining, TUI scan ownership, failed PTY cleanup, malformed RPC input, clipboard-path parsing, session accounting and failed HTTP listener startup.

The full repository gate and production builds are recorded in the delivery result. These checks are not a substitute for trying the UI: the expected Electron CDP endpoint at `127.0.0.1:39217` was unavailable, and the development app was not started. Clipboard behaviour and Pierre/settings interactions still need a live-app check; macOS and Windows were not exercised here.
