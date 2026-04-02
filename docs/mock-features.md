# Mock / stub feature inventory

This file tracks UI surfaces that still look real but are not functionally implemented yet.

Execution backlog lives in: `docs/implementation-todo.md`

## Important runtime note

- **Unhandled desktop actions are currently no-ops that still return success.**
  - Action list: `shared/desktop-actions.ts`
  - Action bridge: `src/app/hooks/useDesktopBridge.ts`
  - IPC dispatch: `electron/main.cts`
  - Backend handler with the real implemented subset: `electron/pi-threads.cts`
  - Anything not explicitly handled in `handleDesktopAction()` currently falls through the `default` case.

## Already real / partially real

These are **not** mock anymore, or at least have real persistence behind them:

- Shell/project index backed by SQLite: `electron/thread-state-db.cts`
- Project collapsed state persistence: `electron/thread-state-db.cts`, `electron/pi-threads.cts`, `src/app/state/workspace.ts`
- Lazy loading of project thread lists: `src/app/hooks/useDesktopShell.ts`, `src/app/AppShell.tsx`, `electron/main.cts`, `electron/pi-threads.cts`
- Lazy loading + caching of opened thread content: `src/app/hooks/useDesktopThread.ts`, `electron/pi-threads.cts`, `electron/thread-state-db.cts`
- Thread pin persistence: `electron/thread-state-db.cts`, `electron/pi-threads.cts`, `src/app/components/sidebar/ProjectTree.tsx`
- Thread archive / restore / permanent delete: `electron/thread-state-db.cts`, `electron/pi-threads.cts`, `src/app/components/settings/ArchivedThreadsPanel.tsx`
- Archived threads settings view: `src/app/components/settings/ArchivedThreadsPanel.tsx`, `src/app/components/sidebar/SettingsMenu.tsx`

---

## Stubbed features by area

### 1. Composer / message sending

**Status:** UI-only. No real compose/send pipeline yet.

- Textarea is uncontrolled UI only: `src/app/components/workspace/Composer.tsx`
- Send button only dispatches `composer.send`: `src/app/components/workspace/Composer.tsx`
- No Electron/backend implementation for:
  - `composer.send`
  - `composer.attach-menu`
  - `composer.model`
  - `composer.thinking`
  - `composer.dictate`
  - `composer.host`
  - `composer.profile`
  - Source of truth: `shared/desktop-actions.ts`, `electron/pi-threads.cts`

**Expansion direction:**
- Create a real composer state model in renderer.
- Add IPC request(s) for create-thread / append-message / stream-response.
- Wire to Pi session creation + continuation in Electron.

### 2. New thread creation

**Status:** Not implemented.

- “New thread” nav item only switches local view to home: `src/app/components/sidebar/Sidebar.tsx`
- Action exists in contract but is not used/handled: `shared/desktop-actions.ts`, `electron/pi-threads.cts`

**Expansion direction:**
- Introduce real `thread.new` flow in Electron.
- Allocate a persisted Pi session immediately or on first send.

### 3. Project actions menu

**Status:** Menu exists; actions are stubbed.

- UI menu: `src/app/components/sidebar/ProjectActionMenu.tsx`
- Emits `project.actions` with sub-actions like:
  - `open-in-file-manager`
  - `create-worktree`
  - `edit-name`
  - `archive-threads`
  - `remove-project`
- No backend implementation: `electron/pi-threads.cts`

**Expansion direction:**
- Split `project.actions` into real typed IPC operations or add a typed sub-action contract.
- Persist project metadata (rename, hide, archive-all, open path, worktree creation).

### 4. Sidebar utility controls

**Status:** Mostly stubbed.

- Filter button emits `threads.filter`: `src/app/components/sidebar/Sidebar.tsx`
- Add project button emits `project.add`: `src/app/components/sidebar/Sidebar.tsx`
- Back/forward emit navigation actions only: `src/app/components/sidebar/Sidebar.tsx`
- No backend behavior for:
  - `nav.back`
  - `nav.forward`
  - `threads.filter`
  - `project.add`

**Expansion direction:**
- Decide whether these are renderer-only behaviors, Electron actions, or both.
- Add search/filter state + project import/create flows.

### 5. Header controls

**Status:** Visual only except local pane toggles.

- Header UI: `src/app/components/workspace/WorkspaceHeader.tsx`
- Local reducer-backed only:
  - terminal toggle
  - diff toggle
- Stubbed actions:
  - `project.switch`
  - `thread.actions`
  - `thread.run-action`
  - `product.menu`
  - `workspace.popout`
  - `workspace.secondary`

**Expansion direction:**
- Add real thread action menu.
- Define workspace duplication/popout behavior in Electron.
- Define project switcher behavior.

### 6. Landing page / project switcher

**Status:** Pure presentation.

- UI: `src/app/views/LandingView.tsx`
- Emits `landing.project-switcher`
- No implementation: `electron/pi-threads.cts`

**Expansion direction:**
- Connect this to a real project picker / recent project switcher.

### 7. Plugins / Automations / Debug pages

**Status:** Mock card surfaces.

- Views: `src/app/views/MainView.tsx`, `src/app/views/CardGridView.tsx`
- Card content source: `src/app/data/mock-data.ts`
- Stub actions:
  - `plugins.open-card`
  - `automations.open-card`
  - `debug.open-card`

**Expansion direction:**
- Replace `mock-data.ts` cards with real data providers.
- Implement action routing per card type.

### 8. Diff panel

**Status:** Mock content.

- UI: `src/app/components/workspace/DiffPanel.tsx`
- Static filenames / static diff lines
- Explicit comment says future replacement is needed
- `diff.review` is not implemented in Electron

**Expansion direction:**
- Feed from actual workspace diffs / review sessions.
- Replace hardcoded content with file-based or session-based diff models.

### 9. Terminal panel

**Status:** Mock shell transcript.

- UI: `src/app/components/workspace/TerminalPanel.tsx`
- Static output lines
- Read-only input
- `terminal.close` action itself is stubbed in Electron; local hide/show is reducer-only via `AppShell`

**Expansion direction:**
- Decide whether this should be a real PTY, Pi terminal stream, or just a run log panel.

### 10. Remote connections banner on home

**Status:** Visual only.

- UI: `src/app/components/workspace/Composer.tsx`
- Stub actions:
  - `connections.add`
  - `connections.dismiss-banner`

**Expansion direction:**
- Replace with real remote host/account state or remove if not planned.

### 11. Product / settings items that are just shells

**Status:** Mostly shell-only.

- Settings popup UI: `src/app/components/sidebar/SettingsMenu.tsx`
- Real archived-threads entry exists now
- Other entries still just UI shells:
  - Settings
  - Language
  - Rate limits remaining
  - Log out

**Expansion direction:**
- Either route through actual desktop settings screens or reduce surface area until implemented.

### 12. Thread metadata / message fidelity

**Status:** Partially simplified.

- Thread messages are reduced to user + assistant prose/list only: `electron/pi-threads.cts`
- Tool results, bash execution, custom messages, branch summaries, compaction summaries are not rendered as first-class UI
- `previousMessageCount` is hardcoded to `0`: `electron/pi-threads.cts`

**Expansion direction:**
- Expand the renderer message model beyond simplified prose/list content.
- Add explicit renderers for tool calls/results and branch/compaction markers.

### 13. Thread creation / continuation lifecycle

**Status:** Read-mostly right now.

- Existing thread indexing/opening is real
- No real workflow yet for:
  - creating a new Pi thread from the UI
  - sending follow-up prompts
  - live streaming assistant output
  - refreshing a thread after send

**Key files:**
- `src/app/components/workspace/Composer.tsx`
- `src/app/hooks/useDesktopThread.ts`
- `electron/pi-threads.cts`

### 14. Unused or contract-only actions

These exist in the action contract but currently do not have meaningful implementation or even an active trigger in the UI:

- `thread.new`
- `workspace.open`

Source: `shared/desktop-actions.ts`

---

## Mock data that still exists

- Card surfaces still use mock data: `src/app/data/mock-data.ts`
- Reducer tests also use mock project fixtures from the same file: `src/app/state/workspace.test.ts`

This is fine for tests, but the card/view content is still placeholder product scaffolding.

---

## Good next expansion order

1. Real composer send / create-thread / continue-thread pipeline
2. Project action menu implementation
3. Replace terminal + diff mock panels with real backing data
4. Replace plugin/automation/debug mock cards with real registries or remove until ready
5. Improve thread rendering fidelity for tool results and non-chat session entries
