# GitOps review and editing redesign

This is the implementation handoff for rebuilding GitOps around the current Pierre APIs. It records the repository trace, upstream capabilities, ownership decisions, and rollout order so the next session does not need to rediscover the feature.

## Product boundary

GitOps is Howcode's single-user review loop for agent-authored work: inspect the agent's changes, annotate them, send review feedback into the active agent thread, and optionally make a quick direct edit. It is not a general Git client or a collaborative code-review system.

Use Pierre's primitives rather than recreating diff geometry, annotation placement, trees, or editing. Keep only the Howcode-specific glue Pierre does not provide: comment state and prompt submission, agent-thread routing, project reads, and explicit edit saves. Do not add merge workflows, staging workbenches, collaboration protocols, or speculative diagnostics infrastructure.

## Current position

- Howcode already pins `@pierre/diffs` **1.3.5** in `package.json` and `bun.lock`.
- Pierre 1.2 introduced `CodeView`; Howcode already uses it.
- Phases 1–3 are implemented: the review domain is tested, Pierre owns line/range selection, and selection offers a transient **Add comment** annotation before opening a draft.
- Pierre's `renderSelectionAction` belongs to its editable `Editor`; read-only `CodeView` does not expose it. Do not enable editing merely to obtain that popover.
- The changed-files rail already uses `@pierre/trees` **1.0.0-beta.6** with Git status, filtering, virtualisation, and multi-path selection. Phase 5 is complete.
- Full diff context hydrates on demand through a revision-pinned, size-limited desktop read contract.
- Direct text-file editing is implemented with a lazy Pierre editor, one active file, expected-revision checks, atomic writes, conflict retention, and review-annotation reanchoring.
- Diagnostic markers and merge-conflict UI are intentionally out of scope unless the agent-review loop develops a concrete need for them.
- GitOps remains plugin-shaped inside `src/app/native/gitops/`; do not add runtime plugin machinery.

No dependency upgrade is needed before this work.

## Upstream facts captured for Pierre Diffs 1.3.5

Official sources:

- Diffs homepage and comments/annotations demo: <https://diffs.com/>
- Edit feature demo: <https://diffs.com/edit>
- Diffs API documentation: <https://diffs.com/docs>
- Diffs 1.2 release and CodeView model: <https://github.com/pierrecomputer/pierre/releases/tag/diffs-v1.2.0>
- Diffs 1.3 release: <https://github.com/pierrecomputer/pierre/releases/tag/diffs-v1.3.0>
- Current releases: <https://github.com/pierrecomputer/pierre/releases>
- Pierre Trees: <https://trees.software/>
- Pierre Trees docs: <https://trees.software/docs>

### Pierre owns rendering primitives, not the review product

The open-source comments feature is an annotation framework. Pierre supplies annotation placement, custom annotation rendering, selection, scrolling, and virtualisation. It does not supply comment persistence, review-session identity, prompt generation, or backend submission.

The durable split is:

- Pierre owns pointer geometry, line/range selection, split/stacked translation, annotation placement, virtualisation, and editor history.
- Howcode owns comment identities and bodies, review context, persistence, UI copy, agent-thread submission, and explicit edit saves.

Do not persist Pierre objects directly. Convert Pierre callback values into Howcode domain values at one adapter boundary.

### CodeView capabilities available now

- Controlled selection with `selectedLines` and `onSelectedLinesChange`.
- Side-aware line ranges across unified and split diffs.
- `scrollTo` targets for items, lines, and ranges.
- Typed custom annotations and `renderAnnotation`.
- Gutter utilities and line interaction callbacks.
- Controlled item ownership with `items`, or imperative ownership with `initialItems` plus ref methods.
- Stable item IDs and explicit `version` updates for changed contents, annotations, or collapsed state.
- `removeItem`, stable scroll anchors, sticky headers, and production-stable virtualisation.
- `renderCodeViewHeader` and `renderCodeViewFooter`, measured inside the scroll container.
- `renderHeaderFilenameSuffix` for file badges or status chips.
- File-level annotations using line `0`.

### Edit capabilities available now

The editor is lazy-loadable from `@pierre/diffs/edit`. React uses `EditProvider`; a `CodeView` item opts into editing and reports complete file contents through `onItemEditChange` and `onItemEditComplete`.

Useful features:

- Edit the new-file side while deleted lines remain read-only.
- Unified and split diff editing.
- Find/replace, undo/redo, multiple cursors, smart indentation, language-aware comment toggling, bracket matching, and auto-surround.
- `renderSelectionAction()` for a popover anchored to selected text. This is the correct primitive for **Add comment**, **Add to chat**, and **Copy**.
- Editable annotations follow inserted, removed, and merged lines and replay through undo/redo.
- `editor.setMarkers()` renders error, warning, info, and hint underlines with hover content.
- Custom clipboard integration for Electron.
- Editor instances and undo history survive CodeView virtualisation.
- `persistState` can retain document, selection, scroll, and undo state for plain file surfaces.

Important constraints:

- Edit remains experimental in 1.3.
- Saving is entirely the consumer's responsibility.
- `persistState` does not apply to diff surfaces.
- Persisted editor state requires stable unique `cacheKey` values; changed content requires a fresh key.
- Markers do not automatically move after edits and must be recalculated.
- React may recreate annotation nodes as they move or leave the virtual window. Annotation-local state must live outside rendered nodes and be keyed by stable IDs. Howcode's external comment store is therefore directionally correct.
- Firefox 125+, Chrome/Edge 123+, and Safari 17.5+ are the stated floors.

### Other significant Diffs features

- `loadDiffFiles` hydrates full old/new contents on demand when expanding context from a patch. Pierre mutates the passed `fileDiff`, so its identity must remain stable.
- `hydratePartialDiff` and `cloneFileDiffMetadata` expose the same operation manually.
- `diffAcceptRejectHunk` accepts, rejects, or keeps both sides of a hunk, and can target one change block. It returns adjusted diff metadata; Howcode intentionally uses that only for the local review display.
- `UnresolvedFile` and `resolveMergeConflict` provide current/incoming/both conflict resolution. These APIs remain experimental and are not part of Howcode's agent-review scope.
- Token hooks expose token text, character offsets, line, side, and element for hover/click actions.
- Added-only and deleted-only files are supported across more render and SSR surfaces.

### Pierre Trees

`@pierre/trees` is a separate beta file-tree package with:

- automatic virtualisation;
- canonical path identity;
- Git status and changed-descendant indicators;
- search/filter modes;
- flattened single-child directories;
- keyboard navigation and ARIA tree semantics;
- multi-selection;
- context-menu composition;
- rename, add/remove/move, and drag/drop;
- sticky folders;
- built-in icon sets and Shiki theming.

The GitOps changed-files tree is the safest evaluation surface. Do not replace project/sidebar trees until the beta API and Howcode styling have proved stable.

## Current Howcode call flow

### Entering and leaving GitOps

1. `src/app/app-shell/useAppShellCommands.ts` resets diff caches and dispatches `open-gitops`.
2. `src/app/state/workspace-action-handlers.ts` changes `activeView`, records `gitOpsReturnView`, hides terminal/takeover surfaces, and tracks the selected diff file.
3. `src/app/code-workspace/code-workspace-view.tsx` derives GitOps view state and composes the main diff plus footer.
4. `src/app/code-workspace/code-workspace-main-area.tsx` mounts `DiffPanel`.
5. `src/app/code-workspace/code-workspace-footer.tsx` mounts `GitOpsComposerPanel`.

Preserve return-view and terminal restoration behaviour during the redesign.

### Diff loading and rendering

1. `src/app/native/gitops/diff-panel.tsx` installs `DiffWorkerPoolProvider` and mounts `DiffPanelContent`.
2. `src/app/native/gitops/diff/diff-panel-content.tsx` calls `useDesktopDiff`, selects the streamed or completed patch, runs worker parsing, filters visible files, and composes review state.
3. `src/app/hooks/useDesktopDiff.ts` starts a project diff stream through `src/app/query/desktop-query.ts`, orders streamed chunks, publishes the assembled patch, and cancels on cleanup.
4. The bridge crosses `shared/desktop-ipc.ts` and `shared/desktop-service-contracts.ts`.
5. `desktop/project-git/commit-context.ts` resolves the baseline, streams a worktree snapshot, and emits typed desktop events.
6. `src/app/native/gitops/diff/diff-panel-file-list.tsx` maps parsed files into Pierre `CodeViewItem`s.

`DiffPanelFileList` currently chooses imperative CodeView ownership with `initialItems={[]}` and manually reconciles append-only updates through the handle. Each item version is a hash of file identity, line counts, annotation metadata, and collapsed state.

### Current comment creation

1. `diff-panel-file-list.tsx` wires Pierre `onLineClick`, `onLineNumberClick`, and a custom gutter button.
2. It also captures pointer-down over the whole CodeView.
3. `useDiffCommentDrafting.ts` installs global `pointermove`, `pointerup`, and `pointercancel` listeners, disables document selection, tracks drag endpoints, suppresses duplicate clicks, and creates a draft.
4. `diff-panel-content.pointer.ts` reads Pierre's rendered DOM attributes through `composedPath()` to infer side and line number.
5. `useDiffPanelCommentState.ts` turns the draft and saved comments into `DiffLineAnnotation<DiffCommentMetadata>` values.
6. Pierre places annotations; `diff-comment-annotation-card.tsx` renders Howcode's draft editor or saved comment.

Pierre annotation rendering is already the correct boundary. The manual pointer/selection machinery is the part to replace.

### Current comment state and persistence

- `diffCommentStore.ts` is a module singleton backed by `localStorage` key `howcode:diff-comments:v1`.
- It validates hydrated values, clones reads/writes, notifies global listeners, debounces persistence by 320 ms, and flushes on `beforeunload`.
- A context contains one draft plus saved comments.
- Its context ID contains project ID, requested baseline descriptor, and whether untracked files are included.
- A default/HEAD context does **not** contain the resolved baseline revision or a worktree snapshot identity. Comments can therefore survive against different patch contents while retaining obsolete line numbers.
- `useDiffPanelCommentState.ts` mirrors one store context into panel-local React state and writes it back through an effect.
- `src/app/code-workspace/useDiffCommentController.ts` independently subscribes to the same store and mirrors comments/count/pending state for the composer.

### Current comment submission

1. Saved comments flow through `CodeWorkspaceView` into `GitOpsComposerPanel` and `useComposerGitOpsState`.
2. When comments exist, the primary GitOps action changes from commit to **Send comments**.
3. `diffCommentPrompt.ts` serialises file path, line/range, old/new side, and body into plain text.
4. `useDiffCommentController.ts` invokes `composer.send` using the configured streaming behaviour.
5. On success it removes only the IDs that were sent, preserving comments added during the request.
6. `code-workspace-footer.tsx` closes GitOps after a successful send.

Preserve the send-ID reconciliation. Do not clear a whole context after an asynchronous send.

## Current hotspots

- `diff-panel-file-list.tsx`: 541 lines; image previews, Pierre item reconciliation, headers, comment selection, annotation rendering, and CodeView composition.
- `composer-git-ops-surface.tsx`: 430 lines.
- `useComposerGitOpsState.ts`: 404 lines; commit and comment-send modes share one state hook.
- `composer-git-ops-footer.tsx`: 376 lines.
- `useDiffCommentDrafting.ts`: 296 lines; mostly selection mechanics Pierre can own.
- `diffCommentStore.ts`: 262 lines.
- `diff-panel-content.tsx`: 248 lines and a broad prop surface into `DiffPanelContentBody`.
- `useDiffPanelScrollAlignment.ts`: 160 lines; combines CodeView scrolling with DOM queries and animation-frame retries.
- `diff-panel-content.pointer.ts`: 97 lines tied to Pierre DOM details.
- Comment props currently travel through `CodeWorkspaceView` → `CodeWorkspaceViewContent` → footer/main area → GitOps panel/surface.

The direct-comment test search returned no matches under `src/test`.

## Target ownership

Keep the public feature entrypoints in `src/app/native/gitops/index.ts`:

- `DiffPanel`
- `GitOpsComposerPanel`
- branch and baseline controls
- review prompt exports required by the host

Inside GitOps, converge on these owned areas:

### `diff/`

- Patch parsing and Pierre CodeView integration.
- Diff loading/empty/error states.
- File visibility and collapse state.
- No comment persistence or composer submission logic.

### `review/`

- Howcode review target and comment types.
- Pierre selection/annotation adapters.
- Comment store and hydration validation.
- Draft/save/remove transitions.
- Comment annotation UI and selection action.
- Prompt generation.
- Minimal visible invalidation if persisted feedback is proven to outlive its diff.

Do not create a generic helpers file. Pure target/range transforms belong with the review model; persistence belongs with the store; Pierre translation belongs in an adapter.

### `edit/`

- Lazy `Editor` creation and `EditProvider` composition.
- Per-file edit state and write scheduling.
- Backend write conflict presentation.
- Clipboard adapter.

### `changed-files/`

- File tree model and selection.
- Pierre Trees integration if accepted after the evaluation phase.

### Host integration

`src/app/code-workspace/useDiffCommentController.ts` currently crosses the native boundary to submit comments. Either rename it to a review controller and keep it as the narrow host adapter, or move submission into a GitOps-owned hook while exposing a grouped review contract to `CodeWorkspaceView`. Do not keep drilling individual comment booleans, counts, callbacks, and IDs.

The preferred host shape is one grouped value:

```ts
type GitOpsReviewController = {
  comments: readonly SavedReviewComment[]
  error: string | null
  sending: boolean
  hasPendingReview: boolean
  selection: { commentId: string | null; jumpKey: number }
  discard: () => void
  select: (commentId: string) => void
  send: (instruction?: string | null) => Promise<boolean>
}
```

Derive `count` from `comments.length`; do not retain the current redundant `diffCommentCount` state/prop.

## Target review model

Do not continue using optional endpoint fields as the core domain shape. Use explicit targets and adapt them to Pierre annotations:

```ts
type DiffPoint = {
  side: 'deletions' | 'additions'
  lineNumber: number
}

type ReviewTarget =
  | {
      kind: 'line-range'
      fileKey: string
      filePath: string
      start: DiffPoint
      end: DiffPoint
    }
  | {
      kind: 'file'
      fileKey: string
      filePath: string
    }

type ReviewComment = {
  id: string
  target: ReviewTarget
  body: string
  createdAt: string
}

type ReviewDraft = {
  target: ReviewTarget
  body: string
}
```

If Pierre's edit selection callback exposes stable character offsets, add a separate `text-range` target variant rather than stuffing offsets into line-range optionals. Capture the selected text in the prompt payload so feedback remains intelligible if line positions later move.

### Review context identity

Review state is local feedback for the active user and agent thread, not a durable collaboration record. Keep enough context to avoid obviously sending comments against unrelated code, but do not build a repository-wide snapshot protocol, detached-comment archive, or migration framework pre-emptively.

The expected-revision check on direct edits exists because the agent may change the same file while the user is editing it. It is a narrow clobber guard, not multiplayer synchronization. If stale persisted comments become a demonstrated problem, invalidate them visibly using the smallest revision signal already available from the diff pipeline.

## Implementation sequence

Each phase should be independently committed and leave the app usable.

### Phase 1 — Model and test the existing contracts

Goal: establish independent oracles before replacing interaction code.

1. Move comment domain code into `src/app/native/gitops/review/` without changing behaviour.
2. Introduce the explicit target model and Pierre adapter.
3. Keep the current storage key/version unless a demonstrated format change requires migration.
4. Group the host review controller and remove redundant count state.
5. Add pure tests for:
   - same-side and cross-side range normalisation;
   - display labels;
   - Pierre annotation conversion;
   - prompt generation;
   - persisted value validation;
   - context IDs across baseline and untracked modes;
   - send success, stopped outcome, failure, and comments added during send.

Likely touched files:

- `src/app/native/gitops/diff/diffCommentStore.ts`
- `src/app/native/gitops/diff/diffCommentPrompt.ts`
- `src/app/native/gitops/diff/diff-panel-content.comments.ts`
- `src/app/native/gitops/diff/useDiffPanelCommentState.ts`
- `src/app/code-workspace/useDiffCommentController.ts`
- `src/app/code-workspace/code-workspace-view.tsx`
- `src/app/code-workspace/code-workspace-footer.tsx`
- new focused tests under `src/test/`

Validation: focused Vitest files, TypeScript, React Doctor, then commit hook.

### Phase 2 — Replace manual selection with Pierre selection

Goal: Pierre becomes the sole owner of line/range pointer geometry.

1. Enable CodeView line selection.
2. Control selection through `selectedLines` and `onSelectedLinesChange` at the React CodeView boundary.
3. Convert Pierre's `{ id, range }` value into a `ReviewTarget` using the item identity map.
4. Open/update the Howcode draft from that target.
5. Retain the gutter **Add comment** button as an explicit single-line affordance.
6. Confirm stacked, split, old-side, new-side, and cross-side selection directly.
7. Simplify comment navigation to CodeView range scrolling where possible.

Expected deletions after parity is proven:

- `src/app/native/gitops/diff/useDiffCommentDrafting.ts`
- `src/app/native/gitops/diff/diff-panel-content.pointer.ts`
- cached `FileInteractionHandlers`
- global pointer listeners and document `user-select` mutation
- click-suppression refs
- manual drag-range state

Do not delete the annotation adapter, card UI, store, or prompt layer. Pierre does not replace them.

Acceptance cases:

- single line by clicking code and line number;
- drag multiple lines in both directions;
- selection in unified and split views;
- selection crossing deletion/addition sides where Pierre permits it;
- starting a second comment while a draft exists;
- selecting inside an annotation does not start another comment;
- virtualised/offscreen annotation navigation;
- Escape/cancel and back/discard behaviour.

### Phase 3 — Add selection actions

Goal: require an explicit action between selecting lines and opening a review draft.

Pierre 1.3.5 only exposes `renderSelectionAction` through the editable `Editor`, not read-only `CodeView`. The implemented read-only path therefore uses Pierre's controlled line selection and a transient Pierre annotation for the action. This keeps Pierre responsible for geometry and placement without hand-positioned DOM or prematurely enabling edit mode. Direct editing can adopt the native editor popover in Phase 6.

1. Add a small Howcode-rendered selection action with **Add comment** and optionally **Add to chat**.
2. Keep the action UI stateless; draft state remains in the review store by stable ID.
3. Prefer this action over opening a draft for every incidental selection.
4. Retain line-number/gutter actions for keyboard and discoverability.

This phase may use read-only controlled line selection first. Character-level targets should wait until the exact editor callback contract and prompt representation are proven.

### Phase 4 — Hydrate full diff context on demand

Goal: expand omitted context without eagerly loading every complete file.

Status: complete. `desktop/project-git/file-content.ts` owns contained baseline/worktree reads and content revisions; `src/app/native/gitops/diff/use-diff-file-content.ts` adapts the typed request to Pierre's `loadDiffFiles` callback.

1. Add a typed read request for old/new file contents at a resolved baseline.
2. Implement it in `desktop/project-git/*` with path containment checks and explicit missing/binary results.
3. Thread the request through:
   - `shared/desktop-project-git-contracts.ts`;
   - `shared/desktop-ipc.ts`;
   - `shared/desktop-service-contracts.ts`;
   - Electron request handlers;
   - headless/dev bridge handlers;
   - `src/app/query/desktop-query.ts`.
4. Supply Pierre's `loadDiffFiles` callback from the CodeView boundary.
5. Keep each parsed `fileDiff` identity stable so hydration persists.

Test independently:

- modified, added, deleted, and renamed text files;
- selected commit/branch/last-opened baselines;
- missing old or new side;
- traversal attempts and symlink escape;
- binary/oversized files;
- a worktree changing during hydration.

### Phase 5 — Evaluate Pierre Trees for changed files

Goal: replace only the GitOps changed-files tree if the beta package reduces code and preserves the UI.

Status: complete. `src/app/native/gitops/diff/diff-changed-files-tree.tsx` uses the pinned Pierre Trees beta and preserves Howcode's focused-path filtering and changed-file statistics.

Current candidate: `src/app/native/gitops/diff/diff-changed-files-tree.tsx`.

Spike requirements:

- preserve multi-path folder/file filtering;
- preserve selected-file fallback behaviour;
- show Git status and changed-descendant indicators;
- compact density and current theme tokens;
- keyboard navigation and focus;
- no drag/drop or mutation actions in the review tree;
- no visual rewrite of the application sidebar.

Proceed only if the production integration is smaller and clearer than the existing model. The package is beta; pin an exact version.

### Phase 6 — Optional direct editing

Goal: edit the new-file side without renderer filesystem access or silent clobbering.

Status: complete. `src/app/native/gitops/edit/` owns editor loading, state, and save orchestration; `desktop/project-git/file-write.ts` owns serialized revision-checked atomic writes. The host exposes only the grouped `GitOpsFileActions` contract and routes writes through `workspace.write-file` so normal Git invalidation/post-effects still apply.

1. Lazy-load `Editor` and mount one `EditProvider` inside the GitOps boundary.
2. Mark only eligible text-file CodeView items editable.
3. Keep edits local on `onItemEditChange`; schedule backend persistence per file.
4. Flush on `onItemEditComplete`, view close, and app shutdown where feasible.
5. Add a typed mutable desktop action for writing one project-relative file.
6. The read contract must return a content revision/hash. Writes must include the expected revision/hash.
7. The backend verifies project containment and expected revision before an atomic write.
8. If the agent or another process changed the file, return a typed conflict. Never overwrite silently.
9. On successful write, invalidate project Git state and the active diff stream through existing post-effects/events.
10. Feed updated annotations returned by Pierre back through the review adapter so comments follow local edits.

Do not write on every keystroke directly through IPC. Use a per-file debounce/serial queue with explicit flush and visible errors. A failed write leaves the editor contents available for retry.

The editor is beta. Ship review selection independently so editing can be delayed or disabled without retaining the old pointer machinery.

### Phase 7 — Keep/undo review

Goal: reproduce Pierre's official accept/reject review interaction without assigning it extra Git semantics.

Status: complete. Each unresolved hunk gets a Pierre annotation with **Undo** and **Keep**. The actions call `diffAcceptRejectHunk` with `reject` or `accept`, respectively, replace only the locally displayed `FileDiffMetadata`, and disappear when Pierre converts the hunk to context. They do not write, stage, or otherwise mutate the repository. A fresh diff source resets the local display, matching the official example's reset behavior.

The implementation lives in focused review modules:

- `review/change-review-model.ts` derives hunk annotations and calls Pierre's transform;
- `review/change-review-action.tsx` renders the two controls;
- `review/use-diff-change-review.ts` owns local displayed-diff replacements.

Do not reinterpret these controls as Git operations. Filesystem editing remains the separate explicit edit/save path from Phase 6.

### Explicit non-goals

- Merge and conflict-resolution workflows.
- Staging or partial-index management.
- Multiplayer review state or cross-device synchronization.
- Diagnostic marker plumbing without a real agent-facing diagnostics producer.
- Reimplementing Pierre interactions in Howcode UI code.

## Behaviour to preserve

- Selected project, session, baseline, render mode, changed-file visibility, and include-untracked scope.
- Project-target and selected-file highlighting.
- Existing GitOps return view and terminal restoration.
- Commit preview/autogenerated message, commit, and commit-push flows.
- Hidden untracked-file warning and inclusion control.
- Back confirmation when a draft or saved comment exists.
- Comment chip navigation.
- Send comments through the active composer/session using configured streaming behaviour.
- Clear only comments actually sent.
- Visible diff, commit, push, comment-send, hydration, and file-write failures.
- ASAR and stock-Node runtime boundaries.

## Things not to preserve

- Pierre DOM-attribute scanning.
- Global pointer listeners for line selection.
- Document-wide `user-select` mutation.
- Duplicate React mirrors and redundant comment counts.
- Broad prop drilling of every comment field and callback.
- Generic HEAD comment contexts that silently survive unrelated patch contents.
- Renderer filesystem access or transport-specific GitOps shims.

## Validation strategy

### Deterministic tests

Keep permanent tests for:

- review target normalisation and Pierre adapters;
- persistence decoding and version migration;
- review context IDs across project, baseline, and untracked scope;
- prompt generation;
- send-and-clear concurrency;
- file-content request path safety;
- revision-checked writes and conflict results;
- backend baseline old/new content resolution;
- post-write diff invalidation.

Do not snapshot Pierre output or encode broad visual parity in tests.

### Live disposable-project matrix

Create one disposable Git repository containing:

- modified tracked file;
- staged and unstaged changes;
- untracked text file;
- added file;
- deleted file;
- renamed file;
- binary image;
- large file with omitted context;

Exercise:

- stacked and split review;
- line and range comments on both sides;
- comment persistence across GitOps close/open;
- baseline and include-untracked changes;
- file-tree filtering;
- comment send and failed send;
- context expansion hydration;
- edit save, reload, undo, and external-change conflict;
- compact and desktop layouts.

Use the existing headless server and browser/CDP workflow. Do not start a second development app.

### Gates

- Focused tests while iterating.
- TypeScript after contract changes.
- React Doctor with score enabled after React surface changes.
- `git diff --check`.
- Commit once the intended phase is complete; the commit hook runs `bun run ai:check`.

## First implementation commit

Start with Phase 1 only: model, tests, grouped controller, and behaviour-preserving moves. Do not combine it with Pierre selection, Trees, backend hydration, or edit mode.

The second commit should replace manual selection and delete the obsolete pointer machinery. This ordering gives the selection rewrite independent review-domain tests and a clean rollback boundary.
