# TODO

Snapshot: May 28, 2026.

One working list. Old planning docs were removed; completed items were ticked off and dropped from here.

## Near-term implementation

- [ ] Validate sherpa-onnx dictation behavior in packaged builds with real downloaded models.
- [ ] Feed commit/pre-commit failures back into the main app UX clearly.
- [ ] Connect review actions to saved comments, changed files, and follow-up actions.
- [ ] Finish thread filtering/search as a coherent product flow beyond renderer-local filtering.
- [ ] Keep polishing scoped-project behavior, empty/error states, and skill-creator packaging details.
- [ ] Revisit post-MVP settings surfaces like rate limits remaining.
- [ ] Expand session parsing beyond simplified user/assistant mapping.
- [ ] Add richer thread block renderers.
- [ ] Finish inbox-adjacent supporting feature work; inbox itself is useful, but depends on surrounding thread/product work.

## Product decisions before implementation

- [ ] Decide whether multi-session / split-terminal UI is needed.
- [ ] Decide whether a separate run-log backend/product mode is still needed.
- [ ] Decide whether filter/search needs backend support.
- [ ] Decide whether thread-level ordering is a real product rule.
- [ ] Revisit router/deep-link ownership after thread/diff/settings state clearly deserves route/search-param ownership.
- [ ] Do not add a router just for structure; add it only when it materially improves navigation semantics.
- [ ] Add explicit restore/delete/archive audit fields if needed.
- [ ] Add indexes only after real usage patterns are confirmed.

## Thread naming

- [ ] Rename thread titles from compaction summaries instead of leaving them as first-user-message truncations.
- [ ] Trigger the rename only when a new compaction is detected, so ordinary thread updates do not recompute titles.
- [ ] Keep the rename path lightweight; if needed, use a tiny Pi prompt or a custom compaction extension/addon that emits a dedicated `thread name` string alongside the summary.

## Automations

- [ ] Define the first real automation feature.

## Bigger epics

### OpenClaw features

- [ ] Write the product definition.
- [ ] Identify which current mocked surfaces belong to this epic.
- [ ] Choose the first thin vertical slice.

Likely connected areas:
- git/worktree flows
- run/review/approval flows
- project action depth
- orchestration-oriented UI

### Just Chat

- [ ] Define what the chat-first mode includes and excludes.
- [ ] Define how it coexists with the full coding workspace.
- [ ] Identify the first slice to ship.

Likely connected areas:
- landing/home
- new thread flow
- thread reading/writing
- lightweight navigation

### Cowork

- [ ] Define the collaboration model.
- [ ] Define how handoff/review/shared presence should work.
- [ ] Identify the first local-only precursor slice if needed.

Likely connected areas:
- handoff
- review comments
- remote execution
- shared thread/project state

### App-aware Pi integration

- [ ] Define the integration boundary.
- [ ] Decide whether this is a plugin system, a bridge, or both.
- [ ] Choose the first app-aware Pi capability to ship.

Likely connected areas:
- run actions
- context passing between app and Pi

### Future extension ecosystem

- [ ] Decide whether this is a standalone epic or the visible expression of the Pi integration extension.
- [ ] Define registry/loading model if it stays.
- [ ] Define the first real cards/providers to replace mocks.
