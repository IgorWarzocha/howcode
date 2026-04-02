# Implementation TODO

This turns `docs/mock-features.md` into an execution backlog.

## Priority backlog

### P0 — Make Pi actually usable from the composer

#### 1. Real composer -> Pi thread pipeline
- [x] Add renderer composer state instead of uncontrolled textarea
  - files: `src/app/components/workspace/Composer.tsx`
- [x] Add IPC contract(s) for creating a thread and sending a prompt
  - files: `electron/contracts.cts`, `electron/preload.cts`, `src/types.d.ts`
- [x] Implement Electron handlers that create/continue Pi sessions
  - files: `electron/main.cts`, `electron/pi-threads.cts`
- [x] Use `createAgentSession()` or equivalent Pi session continuation path
  - files: `electron/pi-threads.cts`
- [x] Persist thread/session metadata into SQLite on send
  - files: `electron/thread-state-db.cts`
- [x] Refresh shell state + opened thread after send
  - files: `src/app/hooks/useDesktopShell.ts`, `src/app/hooks/useDesktopThread.ts`, `src/app/AppShell.tsx`
- [x] Support streaming assistant output instead of waiting for full completion
  - files: `electron/main.cts`, `electron/preload.cts`, `src/app/*`
- [x] Add attachment picking + file/image send support
  - files: `electron/main.cts`, `electron/pi-desktop-runtime.cts`, `src/app/components/workspace/Composer.tsx`

#### 2. New thread creation
- [x] Implement `thread.new` as a real action
  - files: `shared/desktop-actions.ts`, `electron/pi-threads.cts`, `src/app/components/sidebar/Sidebar.tsx`
- [ ] Decide whether sessions are created immediately or on first send
- [ ] Ensure new threads appear in SQLite before/when first message is sent
  - files: `electron/thread-state-db.cts`

### P1 — Replace remaining fake workspace surfaces

#### 3. Project actions menu
- [ ] Replace generic `project.actions` stub with typed project operations
  - files: `shared/desktop-actions.ts`, `electron/contracts.cts`
- [ ] Implement:
  - [ ] open in file manager
  - [ ] edit name
  - [ ] archive all threads
  - [ ] remove project from app index
  - [ ] create permanent worktree
  - files: `electron/pi-threads.cts`, `electron/thread-state-db.cts`, `src/app/components/sidebar/ProjectActionMenu.tsx`

#### 4. Thread action menu / run action
- [ ] Implement `thread.actions`
- [ ] Implement `thread.run-action`
  - files: `src/app/components/workspace/WorkspaceHeader.tsx`, `electron/pi-threads.cts`

#### 5. Terminal panel
- [ ] Replace static terminal transcript with real PTY or run log
  - files: `src/app/components/workspace/TerminalPanel.tsx`
- [ ] Decide if terminal is:
  - [ ] a real shell
  - [ ] a Pi run log
  - [ ] a hybrid
- [ ] Implement close/show state coherently with backend events if needed
  - files: `src/app/AppShell.tsx`, `electron/main.cts`

#### 6. Diff panel
- [ ] Replace hardcoded diff cards with real data
  - files: `src/app/components/workspace/DiffPanel.tsx`
- [ ] Implement `diff.review`
  - files: `electron/pi-threads.cts`, `src/app/components/workspace/DiffPanel.tsx`

### P2 — Improve fidelity and non-core navigation

#### 7. Thread rendering fidelity
- [ ] Render tool results as first-class blocks
- [ ] Render bash execution messages
- [ ] Render custom / branch / compaction markers
- [ ] Replace `previousMessageCount: 0` with real history metadata
  - files: `electron/pi-threads.cts`, `shared/desktop-contracts.ts`, `src/app/components/common/ThreadMessage.tsx`, `src/app/views/ThreadView.tsx`

#### 8. Sidebar utility controls
- [ ] Implement thread filtering/search
- [ ] Implement add/import project flow
- [ ] Decide whether nav back/forward are renderer history or app history
  - files: `src/app/components/sidebar/Sidebar.tsx`, `src/app/state/workspace.ts`, `electron/pi-threads.cts`

#### 9. Landing project switcher / product menu
- [ ] Implement `landing.project-switcher`
- [ ] Implement `project.switch`
- [ ] Implement `product.menu`
  - files: `src/app/views/LandingView.tsx`, `src/app/components/workspace/WorkspaceHeader.tsx`, `electron/pi-threads.cts`

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

### Electron / backend checklist

- [x] Add real send-thread IPC
- [ ] Add real new-thread IPC
- [x] Add stream/event IPC for assistant output
- [ ] Implement typed project actions instead of generic `project.actions`
- [ ] Implement diff review backend
- [ ] Implement terminal backend or run-log backend
- [ ] Implement filter/search backend if needed
- [ ] Implement project import/add flow
- [ ] Expand session parsing beyond simplified user/assistant mapping
- [ ] Add DB migrations/versioning for future schema changes

Key files:
- `electron/main.cts`
- `electron/contracts.cts`
- `electron/preload.cts`
- `electron/pi-threads.cts`
- `electron/thread-state-db.cts`

### Renderer / app-state checklist

- [x] Add controlled composer state
- [x] Add optimistic / streaming thread UI state
- [x] Refresh shell + thread state coherently after mutations
- [ ] Add thread filter/search UI
- [ ] Add proper menus for thread actions / product menu / project switching
- [ ] Replace mock plugin/automation/debug data or remove views
- [ ] Add richer thread block renderers

Key files:
- `src/app/AppShell.tsx`
- `src/app/hooks/useDesktopShell.ts`
- `src/app/hooks/useDesktopThread.ts`
- `src/app/state/workspace.ts`
- `src/app/components/workspace/Composer.tsx`
- `src/app/views/ThreadView.tsx`

### Sidebar / navigation checklist

- [ ] Real new thread creation
- [ ] Real project add/import
- [ ] Real thread filtering
- [ ] Real project action menu operations
- [ ] Real back/forward semantics
- [ ] Real project switcher semantics

Key files:
- `src/app/components/sidebar/Sidebar.tsx`
- `src/app/components/sidebar/ProjectTree.tsx`
- `src/app/components/sidebar/ProjectActionMenu.tsx`
- `src/app/views/LandingView.tsx`

### SQLite / persistence checklist

- [ ] Add schema migration/version strategy
- [ ] Decide project lifecycle rules in DB
- [ ] Decide when sessions are imported vs refreshed
- [ ] Add explicit restore/delete/archive audit fields if needed
- [ ] Add thread send/update write-through rules
- [ ] Add indexes only after real usage patterns are confirmed

Key files:
- `electron/thread-state-db.cts`
- `electron/pi-threads.cts`

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
