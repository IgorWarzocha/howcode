# Grouped todo list

Snapshot: April 26, 2026.

This is the practical working list grouped by what can be done independently, what should land together, and what belongs to larger epics.

## A. Easy wins / cleanup bucket

These are high-value, lower-risk tasks that should make the app feel more honest quickly.

### Status + labeling cleanup

- [x] remove legacy no-op action/status inventory that no longer matches the real UI path
- [x] mark composer stop/dequeue as implemented desktop actions
- [ ] keep unsurfaced `feature:header.*` IDs as trace-only inventory; do not re-surface them until the header comes back

### Small UI shells that can become real quickly


### Small composer/control wins

- [x] wire the composer mic to renderer audio capture + desktop-runtime sherpa-onnx transcription
- [ ] validate sherpa-onnx dictation behavior in packaged builds with real downloaded models
- [x] remove the unused `composer.dictate` action now that dictation uses dedicated IPC
- [ ] tighten README + status docs whenever mock/partial behavior changes

## B. Interconnected implementation batches

These should be tackled as grouped lanes, not as isolated tickets.

### Batch 1 — navigation + header semantics

Work on all of these together so the shell gets one coherent navigation model.

- [ ] implement landing/project switching UX

### Batch 2 — git + diff + review convergence

These are strongly connected and should be designed/implemented together.

- [ ] decide the long-term diff ownership model
  - checkpoint-first
  - git/worktree-first
  - hybrid
- [ ] make composer git-ops the real git UX, not a placeholder surface
- [ ] implement branch switching
- [ ] feed commit/pre-commit failures back into the main app UX clearly
- [ ] connect review actions to saved comments / changed files / follow-up actions
- [ ] evaluate worktree creation as part of the same git workflow pass

### Batch 3 — terminal + host + remote execution convergence

These should become one execution-location story.

- [ ] decide terminal product model: shell, run log, or hybrid
- [ ] add multi-session / split-terminal UI if needed
- [ ] improve terminal affordances like path links / editor opening

### Batch 4 — shell completeness around projects and discovery

- [ ] finish project add/import UX + semantics now that basic create/import handlers exist
- [ ] finish thread filtering/search as a coherent product flow beyond the current renderer-local filtering
- [ ] decide whether thread-level ordering is a real product rule
- [ ] revisit router/deep-link ownership after header/diff/settings semantics are settled

### Batch 5 — surrounding surfaces: settings

- [ ] replace mock card data with real registries/providers if they stay
- [x] keep skills/extensions as real feature lanes separate from the mock card-grid surfaces
- [ ] define the first real automation feature

## C. High-level epics

These need explicit product-definition docs and should not be treated as ordinary cleanup work.

### Epic 1 — OpenClaw features

- [ ] write the product definition
- [ ] identify which current mocked surfaces belong to this epic
- [ ] choose the first thin vertical slice

Likely connected areas:

- git/worktree flows
- run/review/approval flows
- project action depth
- orchestration-oriented UI

### Epic 2 — Just Chat

- [ ] define what the chat-first mode includes and excludes
- [ ] define how it coexists with the full coding workspace
- [ ] identify the first slice to ship

Likely connected areas:

- landing/home
- new thread flow
- thread reading/writing
- lightweight navigation

### Epic 3 — Cowork

- [ ] define the collaboration model
- [ ] define how handoff/review/shared presence should work
- [ ] identify the first local-only precursor slice if needed

Likely connected areas:

- handoff
- review comments
- remote execution
- shared thread/project state

### Epic 4 — extension to tightly integrate Pi with the app

- [ ] define the integration boundary
- [ ] decide whether this is a plugin system, a bridge, or both
- [ ] choose the first app-aware Pi capability to ship

Likely connected areas:

- run actions
- context passing between app and Pi

### Epic 5 — future extension ecosystem

- [ ] decide whether this is a standalone epic or the visible expression of the Pi integration extension
- [ ] define registry/loading model if it stays
- [ ] define the first real cards/providers to replace mocks

## D. Suggested execution order

If we want a sensible work sequence, do this:

1. easy wins / badge cleanup
2. header + project-switch semantics batch
3. git + diff + review batch
4. terminal batch
5. project/discovery batch
7. start one big epic with a written product definition
