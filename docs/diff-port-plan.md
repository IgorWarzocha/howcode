# Diff view port plan from `/home/igorw/Frameworks/t3code`

> Historical note: this investigation doc includes some legacy workspace-header references. Current
> diff ownership lives under `src/app/components/workspace/diff/*` plus `src/app/app-shell/*`.

This document captures the current investigation of the diff-view implementation in `/home/igorw/Frameworks/t3code` and maps it onto `/home/igorw/Work/howcode`.

The goal is faithful adaptation with minimal reinvention.

## Scope

- Reuse the frontend diff rendering stack from `/home/igorw/Frameworks/t3code`
- Recreate the minimum backend diff pipeline needed in `/home/igorw/Work/howcode`
- Avoid porting t3code router/orchestration/read-model machinery wholesale when a smaller desktop-local equivalent is enough
- Keep all file references absolute for future agent work

## Key implementation direction

For `/home/igorw/Work/howcode`, checkpoint capture should happen at a stable turn boundary, not continuously.

The preferred hook is:

- when the Pi agent emits an agent-turn-complete / agent-turn-stop style event
- then capture the post-turn checkpoint
- compare it against the previous baseline checkpoint

This is preferable to real-time checkpointing because real-time checkpointing would create noisy, low-value intermediate states and does not match the user-facing semantics of a completed turn diff.

Recommended checkpoint lifecycle for `/home/igorw/Work/howcode`:

1. Ensure a baseline checkpoint exists before a turn begins
2. Wait until the agent turn fully stops/completes
3. Capture the post-turn checkpoint once
4. Compute the diff between previous checkpoint and new checkpoint
5. Persist diff summary metadata for the thread

## Investigated t3code files

### Frontend

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/hooks/useTurnDiffSummaries.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/diffRouteSearch.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/providerReactQuery.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/routes/_chat.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/routes/_chat.$threadId.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/ChatView.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChatHeader.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/MessagesTimeline.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChangedFilesTree.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/ChatMarkdown.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/turnDiffTree.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/chat-scroll.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/index.css`

### Backend

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointDiffQuery.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointStore.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Diffs.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Services/CheckpointDiffQuery.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Services/CheckpointStore.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Utils.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/Layers/CheckpointReactor.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/projector.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/decider.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/wsServer.ts`

### Contracts

- `/home/igorw/Frameworks/t3code/packages/contracts/src/orchestration.ts`
- `/home/igorw/Frameworks/t3code/packages/contracts/src/ipc.ts`

### Current howcode files relevant to the port

- `/home/igorw/Work/howcode/src/app/components/workspace/DiffPanel.tsx`
- `/home/igorw/Work/howcode/src/app/components/workspace/WorkspaceHeader.tsx`
- `/home/igorw/Work/howcode/src/app/app-shell/AppShellLayout.tsx`
- `/home/igorw/Work/howcode/src/app/app-shell/useAppShellController.ts`
- `/home/igorw/Work/howcode/src/app/state/workspace.ts`
- `/home/igorw/Work/howcode/shared/desktop-actions.ts`
- `/home/igorw/Work/howcode/shared/desktop-contracts.ts`
- `/home/igorw/Work/howcode/src/app/desktop/types.ts`
- `/home/igorw/Work/howcode/desktop/pi-threads/action-router.cts`
- `/home/igorw/Work/howcode/src/bun/index.ts`
- `/home/igorw/Work/howcode/src/app/desktop/electrobun-api.ts`

## Architecture summary of t3code diff views

### 1. Frontend diff rendering stack

Primary renderer:

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`

Worker pool:

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`

Helpers:

- `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`

What it uses:

- `@pierre/diffs`
- `@pierre/diffs/react`

Rendering flow:

1. Fetch unified patch text
2. Parse patch text with `parsePatchFiles(...)`
3. Flatten parsed patch files
4. Render each file with `<FileDiff />`
5. Wrap file list with `@pierre/diffs/react` `<Virtualizer />`

Display modes:

- stacked mode -> unified diff
- split mode -> split diff

Theming:

- theme names resolved in `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`
- worker pool theme updated in `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`
- CSS overrides injected through `unsafeCSS` in `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`

Virtualization strategy:

- diff file list virtualization comes from `@pierre/diffs/react` `Virtualizer`
- the app does not manually build virtualized diff DOM

File selection and scrolling:

- selected file path comes from route search state
- matching rendered file node is found via `data-diff-file-path`
- then `scrollIntoView({ block: "nearest" })`

Open-in-editor behavior:

- click on diff header title is detected via `[data-title]`
- file path is resolved relative to cwd
- then forwarded to the native editor open bridge

### 2. Diff panel UX architecture

Open/selection state is route-driven:

- `/home/igorw/Frameworks/t3code/apps/web/src/diffRouteSearch.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/routes/_chat.$threadId.tsx`

Search params:

- `diff=1`
- `diffTurnId=<turnId>`
- `diffFilePath=<path>`

Wide layouts:

- inline right sidebar

Small layouts:

- right-side sheet

Selected turn tracking:

- diff panel resolves selected turn from `diffTurnId`
- if no turn is selected, it shows the whole-thread diff

Selected file tracking:

- file path is only considered when a specific turn is selected

Navigation into a diff:

- header diff toggle in `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChatHeader.tsx`
- changed-files blocks in `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/MessagesTimeline.tsx`
- file-tree rows in `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChangedFilesTree.tsx`

### 3. Diff data-fetching model

Query layer:

- `/home/igorw/Frameworks/t3code/apps/web/src/lib/providerReactQuery.ts`

Decision logic:

- if `fromTurnCount === 0`, request whole-thread diff
- otherwise request a single turn diff

Caching:

- query key includes thread id, from count, to count, and cache scope
- stale time is effectively infinite

Retry behavior:

- temporary checkpoint-unavailable errors retry longer
- normal failures retry only a few times

Normalized user-facing errors:

- no-git repository message
- checkpoint unavailable message
- generic fallback message

### 4. Backend diff computation model

Primary query adapter:

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointDiffQuery.ts`

Filesystem checkpoint store:

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointStore.ts`

Checkpoint refs:

- built under `refs/t3/checkpoints/...` in `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Utils.ts`

Meaning of counts:

- `turnCount = 0` is the pre-turn baseline
- `turnCount = N` is the checkpoint after turn `N`
- single-turn diff = `N - 1 -> N`
- full-thread diff = `0 -> latest`

How git diff is computed:

- resolve checkpoint ref to commit oid
- run `git diff --patch --minimal --no-color <from> <to>`

How file summaries are derived:

- parse unified patch with `parsePatchFiles(...)`
- sum additions/deletions per file
- store a flat file summary list

How diffs become available:

- provider/runtime ingestion may emit an early placeholder entry
- checkpoint reactor later captures the real git checkpoint and replaces placeholder state
- frontend retries while that state settles

For `/home/igorw/Work/howcode`, this can be simplified by capturing only at stable turn completion rather than supporting placeholder diff states.

## Dependency summary

### Essential frontend packages for faithful port

- `@pierre/diffs`
- `@pierre/diffs/react`

These are not currently present in `/home/igorw/Work/howcode/package.json`.

### Useful but optional

- `@tanstack/react-query`
  - t3code uses this in `/home/igorw/Frameworks/t3code/apps/web/src/lib/providerReactQuery.ts`
  - `/home/igorw/Work/howcode` can replace it with a custom hook and local async state

- `@tanstack/react-router`
  - t3code uses this for diff open/selection state
  - `/home/igorw/Work/howcode` should keep diff state in `/home/igorw/Work/howcode/src/app/state/workspace.ts`

- `@pierre/diffs` on the backend
  - optional but useful for parsing unified patch output into file summaries

### Existing packages already usable in `/home/igorw/Work/howcode`

- `lucide-react`
- `react`
- `react-dom`

## Portability analysis

### Portable as-is or close to as-is

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`
- most of `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/turnDiffTree.ts`
- most of `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChangedFilesTree.tsx`
- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Diffs.ts`

### Coupled to t3code and should not be ported directly

- `/home/igorw/Frameworks/t3code/apps/web/src/diffRouteSearch.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/providerReactQuery.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/routes/_chat.$threadId.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/ChatView.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/MessagesTimeline.tsx`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/Layers/CheckpointReactor.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/orchestration/projector.ts`
- `/home/igorw/Frameworks/t3code/apps/server/src/wsServer.ts`

### Minimal standalone behavior needed in `/home/igorw/Work/howcode`

1. A right-hand diff panel using `@pierre/diffs`
2. Local diff panel state in the workspace reducer
3. Backend APIs to request patch text for:
   - full-thread diff
   - latest turn diff
   - selected turn diff
4. One stable checkpoint capture per completed turn
5. Optional changed-files summary UI in the thread view

## Mapping from t3code modules to howcode modules

### Frontend mapping

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`
  -> `/home/igorw/Work/howcode/src/app/components/workspace/diff/DiffPanel.tsx`

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`
  -> `/home/igorw/Work/howcode/src/app/components/workspace/diff/DiffWorkerPoolProvider.tsx`

- `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`
  -> `/home/igorw/Work/howcode/src/app/components/workspace/diff/diff-rendering.ts`

- `/home/igorw/Frameworks/t3code/apps/web/src/lib/turnDiffTree.ts`
  -> `/home/igorw/Work/howcode/src/app/components/workspace/diff/turn-diff-tree.ts`

- `/home/igorw/Frameworks/t3code/apps/web/src/components/chat/ChangedFilesTree.tsx`
  -> `/home/igorw/Work/howcode/src/app/components/workspace/diff/ChangedFilesTree.tsx`

- `/home/igorw/Frameworks/t3code/apps/web/src/lib/providerReactQuery.ts`
  -> `/home/igorw/Work/howcode/src/app/hooks/useDesktopDiff.ts`

- route search params from `/home/igorw/Frameworks/t3code/apps/web/src/diffRouteSearch.ts`
  -> reducer state in `/home/igorw/Work/howcode/src/app/state/workspace.ts`

### Backend mapping

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Diffs.ts`
  -> `/home/igorw/Work/howcode/desktop/diff/parse-diff-summary.cts`

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointStore.ts`
  -> `/home/igorw/Work/howcode/desktop/diff/checkpoint-store.cts`

- `/home/igorw/Frameworks/t3code/apps/server/src/checkpointing/Layers/CheckpointDiffQuery.ts`
  -> `/home/igorw/Work/howcode/desktop/diff/checkpoint-diff-query.cts`

- orchestration contracts from `/home/igorw/Frameworks/t3code/packages/contracts/src/orchestration.ts`
  -> desktop-local contracts in `/home/igorw/Work/howcode/shared/desktop-contracts.ts`

## Minimal port plan

### Phase 1: frontend renderer port

Create:

- `/home/igorw/Work/howcode/src/app/components/workspace/diff/DiffWorkerPoolProvider.tsx`
- `/home/igorw/Work/howcode/src/app/components/workspace/diff/diff-rendering.ts`
- `/home/igorw/Work/howcode/src/app/components/workspace/diff/DiffPanel.tsx`

Adapt nearly directly from:

- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffWorkerPoolProvider.tsx`
- `/home/igorw/Frameworks/t3code/apps/web/src/lib/diffRendering.ts`
- `/home/igorw/Frameworks/t3code/apps/web/src/components/DiffPanel.tsx`

Initial simplifications:

- no route-search-param integration
- no sheet mode
- no resizable inline sidebar
- keep current `/home/igorw/Work/howcode/src/app/app-shell/AppShellLayout.tsx` diff slot

### Phase 2: reducer state for diff selection

Extend `/home/igorw/Work/howcode/src/app/state/workspace.ts` with:

- `selectedDiffTurnId: string | null`
- `selectedDiffFilePath: string | null`
- optional `diffRenderMode: "stacked" | "split"`

### Phase 3: contracts and bridge APIs

Extend `/home/igorw/Work/howcode/shared/desktop-contracts.ts` with:

- `TurnDiffFile`
- `TurnDiffSummary`
- `TurnDiffRequest`
- `TurnDiffResult`

Expose bridge methods from `/home/igorw/Work/howcode/src/bun/index.ts` and `/home/igorw/Work/howcode/src/app/desktop/electrobun-api.ts`:

- `getTurnDiff(...)`
- `getFullThreadDiff(...)`

### Phase 4: backend checkpoint store and diff query

Create:

- `/home/igorw/Work/howcode/desktop/diff/checkpoint-store.cts`
- `/home/igorw/Work/howcode/desktop/diff/checkpoint-diff-query.cts`
- `/home/igorw/Work/howcode/desktop/diff/parse-diff-summary.cts`

Behavior:

- hidden git refs per thread/session turn count
- baseline checkpoint exists before a turn
- post-turn checkpoint captured once at turn completion
- unified patch text returned on demand
- file summaries persisted for UI navigation

### Phase 5: thread-level changed-file affordances

Add:

- `/home/igorw/Work/howcode/src/app/components/workspace/diff/ChangedFilesTree.tsx`
- `/home/igorw/Work/howcode/src/app/components/workspace/diff/turn-diff-tree.ts`

Then integrate changed-file summaries into:

- `/home/igorw/Work/howcode/src/app/components/common/ThreadMessage.tsx`
  or
- `/home/igorw/Work/howcode/src/app/views/ThreadView.tsx`

This should become the primary navigation path into a selected turn diff.

## State model recommended for howcode

Renderer state:

- `diffVisible: boolean`
- `selectedDiffTurnId: string | null`
- `selectedDiffFilePath: string | null`
- optional `diffRenderMode: "stacked" | "split"`

Backend/shared state:

- thread-local turn diff summaries
- checkpoint turn count per summary
- optional assistant-message linkage for “changed files” blocks

## Risks and coupling points

### Main risks

- `/home/igorw/Work/howcode` does not yet expose turn/checkpoint metadata comparable to t3code
- Pi runtime event boundaries may not line up perfectly with t3code’s turn model
- non-git projects must fail gracefully
- hidden checkpoint refs need cleanup when threads are archived/deleted
- path normalization and open-in-editor behavior need to be platform-safe

### Coupling points to avoid

- t3code route/search-param model
- t3code Effect service/layer architecture as a hard dependency
- t3code placeholder checkpoint lifecycle if a simpler turn-stop capture works reliably in `/home/igorw/Work/howcode`

### Simplifications acceptable in howcode

- start with full-thread diff + latest-turn diff if selected-turn history is not yet available
- skip placeholder “missing” checkpoints entirely
- do not port sheet/sidebar mode split yet
- use desktop-local async hooks instead of `@tanstack/react-query`

## Recommended first implementation pass

1. Add `@pierre/diffs` and `@pierre/diffs/react`
2. Port the frontend diff renderer into `/home/igorw/Work/howcode/src/app/components/workspace/diff/*`
3. Add local diff selection state to `/home/igorw/Work/howcode/src/app/state/workspace.ts`
4. Add backend contracts for full-thread diff and selected-turn diff
5. Implement git checkpoint capture only at turn completion
6. Persist file summaries for future changed-file navigation

This preserves the strongest parts of t3code’s implementation while keeping `/home/igorw/Work/howcode` aligned with its simpler desktop architecture.
