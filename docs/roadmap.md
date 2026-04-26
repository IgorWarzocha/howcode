# Product roadmap

Snapshot: April 26, 2026.

This roadmap turns the current mock/partial audit into a product plan.

## Where the app stands now

The app already has a real core:

- Pi composer send + streaming
- persisted project/thread index
- live thread hydration from Pi session files
- real PTY-backed terminal
- checkpoint-backed diff rendering
- PTY terminal takeover mode
- real project actions except worktree creation
- partial git/commit actions
- local sherpa-onnx dictation path
- persisted inbox flow
- real skills/extensions browse/install surfaces

What remains is mostly a mix of:

- **mock controls** that need real behavior
- **partial flows** that need end-to-end completion
- **product-direction bets** that need definition before implementation

## Guiding principles

1. Keep the shell useful while shipping deeper features.
2. Prefer one coherent implementation pass per connected area instead of scattered one-off fixes.
3. Remove or hide fake surfaces if we do not plan to make them real soon.
4. Keep the Electron + shared-contract architecture intact while using Bun only for installs, scripts, and build orchestration.

## Phase 1 — close obvious product gaps

These are the highest-value "make the current app feel honest" items:

- finish header/navigation semantics
- clean up stale no-op action inventory vs real implementations
- finish small-but-visible composer/settings/control gaps, especially host/remote and packaged dictation validation
- decide which mock views stay visible and which should be hidden until real

Representative items:

- thread action menu / run action
- workspace open / open options / handoff / popout decisions
- validate packaged dictation behavior and decide whether the legacy `composer.dictate` action ID should stay
- status-marker cleanup for project actions already backed by real behavior
- keep header trace IDs documented without bringing the header UI back early

## Phase 2 — converge git, diff, review, and terminal workflows

This is the main "make it feel like a real coding desktop" phase.

### Git + diff + review convergence

- replace remaining mock git affordances with a git-native worktree/project flow
- unify composer git-ops, project diff state, and review actions
- make branch switching, commit options, and review follow-up feel native
- decide whether the long-term diff model is primarily:
  - per-turn checkpoints,
  - worktree diff since last commit,
  - or a hybrid

### Terminal + host + remote execution convergence

- finish the terminal model: shell, run log, or hybrid
- add multi-session / split-terminal support if needed
- define `composer.host`, remote connections, and handoff as one coherent execution-location story
- tighten takeover terminal parity with the regular workspace flow

## Phase 3 — complete the surrounding product shell

These areas matter, but should follow the core workflow work above:

- plugin / automation / debug surfaces; skills/extensions have real feature lanes already
- project add/import flow
- thread filtering/search
- richer settings/account surfaces
- deeper router/deep-link semantics once the state model justifies it

## Major epics / product bets

These are bigger than ordinary backlog items and should be treated as explicit epics.

### 1. OpenClaw features

Bring in the larger repository/workflow features that currently read like future-facing product surface area rather than completed workflows.

Examples:

- richer repo operations
- review / run / approval workflows
- stronger worktree and project-level operations
- execution history and workflow orchestration features

This should be planned as a coherent product lane, not a pile of small UI toggles.

### 2. Just Chat

A lighter-weight mode where the product is great even without the full project shell around it.

Potential direction:

- chat-first landing and thread experience
- less workspace chrome
- easier new-thread / recent-thread flow
- stronger focus on conversation continuity and model controls

This is useful both as a product mode and as a forcing function for simplifying the shell.

### 3. Cowork

Collaboration features beyond a single-user local shell.

Potential direction:

- shared threads or shared review state
- presence / handoff / async collaboration
- project-level collaboration cues
- comment/review workflows that are not purely local

Cowork should likely absorb or redefine today's mock handoff / review / remote surfaces.

### 4. Extension to tightly integrate Pi with the app

Build a tighter integration layer so Pi and the app share more context and actions.

Potential direction:

- app-aware Pi actions
- better selection/context passing
- richer diff / terminal / project context handoff
- tighter extension/plugin hooks between Pi and the desktop shell

This may become the long-term answer for several current mock areas: plugins, automations, host controls, run actions, and review hooks.

### 5. Real extension / automation / debug ecosystem

Today's plugins/automations/debug views are mostly mock scaffolding.

Long-term options:

- ship a real extension registry / local extension system
- ship a real automation catalog
- turn debug into a serious inspector/devtools surface
- or remove these product areas if they do not earn their place

## Sequencing recommendation

Recommended order:

1. clean up visible drift and small mocks
2. implement header/action semantics together if and when the header returns
3. implement git/diff/review together
4. implement terminal/host/remote/handoff together
5. decide the fate of plugins/automations/debug
6. start one major epic at a time: OpenClaw, Just Chat, Cowork, Pi integration extension

## Definition of progress

We should consider the app meaningfully upgraded when:

- the visible mock labels mostly correspond to real unfinished areas
- header/navigation controls are not fake
- git, diff, review, and terminal flows feel like one system
- the remaining mock surfaces are either actively planned or removed
- at least one big epic has a written product definition and first implementation slice
