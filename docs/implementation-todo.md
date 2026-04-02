# Implementation TODO

This turns `docs/mock-features.md` into an execution backlog.

## Priority backlog

### P0 — Make Pi actually usable from the composer

#### 1. Real composer -> Pi thread pipeline
- [x] Add renderer composer state instead of uncontrolled textarea
  - files: `src/app/components/workspace/Composer.tsx`
- [x] Add desktop bridge contract(s) for creating a thread and sending a prompt
  - files: `shared/electrobun-rpc.ts`, `src/app/desktop/electrobun-api.ts`, `src/types.d.ts`
- [x] Implement desktop-runtime handlers that create/continue Pi sessions
  - files: `src/bun/index.ts`, `desktop/pi-threads.cts`
- [x] Use `createAgentSession()` or equivalent Pi session continuation path
  - files: `desktop/pi-threads.cts`
- [x] Persist thread/session metadata into SQLite on send
  - files: `desktop/thread-state-db.cts`
- [x] Refresh shell state + opened thread after send
  - files: `src/app/hooks/useDesktopShell.ts`, `src/app/hooks/useDesktopThread.ts`, `src/app/AppShell.tsx`
- [x] Support streaming assistant output instead of waiting for full completion
  - files: `src/bun/index.ts`, `src/app/desktop/electrobun-api.ts`, `src/app/*`
- [x] Add attachment picking + file/image send support
  - files: `src/bun/index.ts`, `desktop/pi-desktop-runtime.cts`, `src/app/components/workspace/Composer.tsx`
- [x] Surface basic composer send/model errors inline
  - files: `desktop/pi-desktop-runtime.cts`, `src/app/components/workspace/Composer.tsx`

#### 2. New thread creation
- [x] Implement `thread.new` as a real action
  - files: `shared/desktop-actions.ts`, `desktop/pi-threads/action-router.cts`, `desktop/runtime/composer-service.cts`, `src/app/components/sidebar/Sidebar.tsx`
- [ ] Decide whether sessions are created immediately or on first send
- [ ] Ensure new threads appear in SQLite before/when first message is sent
  - files: `desktop/thread-state-db/*`

### P1 — Replace remaining fake workspace surfaces

#### 3. Project actions menu
- [x] Replace generic project menu stubs with explicit project actions for current supported items
  - files: `shared/desktop-actions.ts`, `desktop/pi-threads/action-router.cts`, `shared/desktop-action-coverage.ts`
- [ ] Implement:
  - [x] open in file manager
  - [x] edit name
  - [x] archive all threads
  - [x] remove project from app index
  - [ ] create permanent worktree
  - files: `desktop/pi-threads/action-router.cts`, `desktop/thread-state-db/*`, `src/app/components/sidebar/ProjectActionMenu.tsx`, `src/app/components/sidebar/ProjectActionDialog.tsx`

#### 4. Thread action menu / run action
- [ ] Implement `thread.actions`
- [ ] Implement `thread.run-action`
  - files: `src/app/components/workspace/WorkspaceHeader.tsx`, `desktop/pi-threads/action-router.cts`

#### 4b. Header open / commit controls
- [ ] Implement `workspace.open`
- [ ] Implement `workspace.open-options`
- [ ] Implement `workspace.handoff`
- [ ] Implement `workspace.commit`
- [ ] Implement `workspace.commit-options`
  - files: `src/app/components/workspace/WorkspaceHeader.tsx`, `desktop/pi-threads/action-router.cts`

#### 5. Terminal panel
- [x] Replace static terminal transcript with a real PTY-backed xterm.js viewport
  - files: `src/app/components/workspace/TerminalPanel.tsx`, `src/app/components/workspace/terminal/TerminalViewport.tsx`, `desktop/terminal/*`, `src/bun/index.ts`
- [ ] Decide if terminal should remain:
  - [ ] a real shell
  - [ ] a Pi run log
  - [ ] a hybrid
- [x] Implement open/write/resize/close event flow with Bun PTY + Windows `node-pty` fallback
  - files: `shared/terminal-contracts.ts`, `shared/electrobun-rpc.ts`, `desktop/terminal/*`, `src/app/hooks/useDesktopTerminal.ts`
- [ ] Add multi-terminal/split terminal UI if Codex parity requires it

#### 6. Diff panel
- [ ] Replace hardcoded diff cards with real data
  - files: `src/app/components/workspace/DiffPanel.tsx`
- [ ] Implement `diff.review`
  - files: `desktop/pi-threads/action-router.cts`, `src/app/components/workspace/DiffPanel.tsx`

### P2 — Improve fidelity and non-core navigation

#### 7. Thread rendering fidelity
- [x] Render tool results as first-class blocks
- [x] Render bash execution messages
- [x] Render custom / branch / compaction markers
- [x] Replace `previousMessageCount: 0` with real history metadata
  - files: `shared/pi-message-mapper.ts`, `desktop/pi-threads/thread-loader.cts`, `desktop/runtime/thread-publisher.cts`, `shared/desktop-contracts.ts`, `src/app/components/common/ThreadMessage.tsx`, `src/app/views/ThreadView.tsx`

#### 8. Sidebar utility controls
- [ ] Implement thread filtering/search
- [ ] Implement add/import project flow
- [ ] Decide whether nav back/forward are renderer history or app history
  - files: `src/app/components/sidebar/Sidebar.tsx`, `src/app/state/workspace.ts`, `desktop/pi-threads/action-router.cts`

#### 9. Landing project switcher
- [ ] Implement `landing.project-switcher`
- [ ] Implement `project.switch`
  - files: `src/app/views/LandingView.tsx`, `src/app/components/workspace/WorkspaceHeader.tsx`, `desktop/pi-threads/action-router.cts`

### P3 — Secondary product areas

#### 10. Plugins / Automations / Debug pages
- [ ] Replace placeholder cards with real registries/data
- [ ] Or intentionally hide/remove these views until real
  - files: `src/app/views/MainView.tsx`, `src/app/views/CardGridView.tsx`, `src/app/data/mock-data.ts`

#### 11. Connections / settings shell items
- [ ] Implement remote connection flow
- [ ] Implement language/settings/rate limits/logout screens or route-outs
  - files: `src/app/components/workspace/Composer.tsx`, `src/app/components/sidebar/SettingsMenu.tsx`

---

## Checklist by layer

### Bun / desktop backend checklist

- [x] Add real send-thread desktop bridge requests
- [ ] Add real new-thread desktop bridge requests
- [x] Add stream/event desktop bridge messages for assistant output
- [ ] Implement typed project actions instead of generic `project.actions`
- [ ] Implement diff review backend
- [ ] Implement terminal backend or run-log backend
- [ ] Implement filter/search backend if needed
- [ ] Implement project import/add flow
- [ ] Expand session parsing beyond simplified user/assistant mapping
- [ ] Add DB migrations/versioning for future schema changes

Key files:
- `src/bun/index.ts`
- `shared/electrobun-rpc.ts`
- `src/app/desktop/electrobun-api.ts`
- `desktop/pi-threads/*`
- `desktop/terminal/*`
- `desktop/runtime/*`
- `desktop/thread-state-db/*`

### Renderer / app-state checklist

- [x] Add controlled composer state
- [x] Add optimistic / streaming thread UI state
- [x] Refresh shell + thread state coherently after mutations
- [ ] Add thread filter/search UI
- [ ] Add proper menus for thread actions / project switching / header split-button actions
- [ ] Replace mock plugin/automation/debug data or remove views
- [ ] Add richer thread block renderers

Key files:
- `src/app/AppShell.tsx`
- `src/app/app-shell/*`
- `src/app/hooks/useDesktopShell.ts`
- `src/app/hooks/useDesktopThread.ts`
- `src/app/state/workspace.ts`
- `src/app/components/workspace/Composer.tsx`
- `src/app/components/workspace/composer/*`
- `src/app/views/ThreadView.tsx`

### Sidebar / navigation checklist

- [x] Real new thread creation
- [ ] Real project add/import
- [ ] Real thread filtering
- [x] Real project action menu operations except worktree creation
- [ ] Real back/forward semantics
- [ ] Real project switcher semantics

Key files:
- `src/app/components/sidebar/Sidebar.tsx`
- `src/app/components/sidebar/ProjectTree.tsx`
- `src/app/components/sidebar/ProjectActionMenu.tsx`
- `src/app/components/sidebar/project-tree/*`
- `src/app/views/LandingView.tsx`

### SQLite / persistence checklist

- [ ] Add schema migration/version strategy
- [ ] Decide project lifecycle rules in DB
- [ ] Decide when sessions are imported vs refreshed
- [ ] Add explicit restore/delete/archive audit fields if needed
- [ ] Add thread send/update write-through rules
- [ ] Add indexes only after real usage patterns are confirmed

Key files:
- `desktop/thread-state-db/*`
- `desktop/pi-threads/*`

---

## Recommended next milestone

### Milestone: "Real Pi composer"

Definition of done:

- [x] Clicking send on a new thread creates a real Pi session
- [x] Clicking send on an existing thread appends to the real Pi session
- [x] Assistant output appears in the thread UI
- [x] Sidebar updates recency/title/thread presence correctly
- [ ] SQLite stays the local index/cache, not the source of truth for actual Pi conversation content

This milestone is now in place. Next, finish the remaining non-chat composer actions and then move to project actions / terminal / diff parity.

## Hardening progress snapshot

- [x] Shared Pi message/title mapping extracted to `shared/pi-message-mapper.ts`
- [x] SQLite layer split into `desktop/thread-state-db/*`
- [x] Pi runtime split into `desktop/runtime/*`
- [x] Pi thread loader/router split into `desktop/pi-threads/*`
- [x] App shell split into `src/app/app-shell/*`
- [x] Composer split into `src/app/components/workspace/composer/*`
- [x] Project tree split into `src/app/components/sidebar/project-tree/*`
- [x] Desktop action coverage made explicit in `shared/desktop-action-coverage.ts`
- [x] Deterministic tests added for shared mapping and payload parsing under `src/test/*`
