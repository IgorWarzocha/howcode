# Mock / stub feature inventory

This file tracks UI surfaces that still look real but are not functionally implemented yet.

Execution backlog lives in: `docs/implementation-todo.md`

## Important runtime note

- **Some desktop actions are intentionally backend no-ops that still return success.**
  - Action list: `shared/desktop-actions.ts`
  - Explicit implemented vs no-op partition: `shared/desktop-action-coverage.ts`
  - Action bridge: `src/app/hooks/useDesktopBridge.ts`
  - Bun RPC dispatch: `src/bun/index.ts`, `shared/electrobun-rpc.ts`, `src/app/desktop/electrobun-api.ts`
  - Backend action router: `desktop/pi-threads/action-router.cts`
  - Shell loading lane: `desktop/pi-threads/shell-loader.cts`
  - Thread hydration lane: `desktop/pi-threads/thread-loader.cts`

## UI status markers

- Mock and partial UI affordances are now tagged through `src/app/features/feature-status.tsx`.
- `mock` renders as red.
- `partial` renders as yellow.
- Grep `feature:` or `FeatureStatusBadge` to find these surfaces quickly.

## Already real / partially real

These are **not** mock anymore, or at least have real persistence behind them:

- Shell/project index backed by SQLite: `desktop/thread-state-db/*`, `desktop/pi-threads/shell-loader.cts`
- Project collapsed state persistence: `desktop/thread-state-db/*`, `desktop/pi-threads/action-router.cts`, `src/app/state/workspace.ts`
- Lazy loading of project thread lists: `src/app/hooks/useDesktopShell.ts`, `src/app/app-shell/useAppShellController.ts`, `src/bun/index.ts`, `desktop/pi-threads/thread-loader.cts`
- Opened thread content now hydrates directly from Pi session files; SQLite is only project/thread metadata and diff-summary index state: `src/app/hooks/useDesktopThread.ts`, `desktop/pi-threads/thread-loader.cts`, `desktop/thread-state-db/*`
- The actively displayed session is now watched for external Pi JSONL writes so the open thread refreshes from disk without polling every session: `desktop/pi-threads/session-watch.cts`, `desktop/runtime/thread-publisher.cts`, `src/app/app-shell/useAppShellController.ts`, `src/bun/index.ts`
- Thread pin persistence: `desktop/thread-state-db/*`, `desktop/pi-threads/action-router.cts`, `src/app/components/sidebar/ProjectTree.tsx`
- Thread archive / restore / permanent delete: `desktop/thread-state-db/*`, `desktop/pi-threads/action-router.cts`, `src/app/components/settings/ArchivedThreadsPanel.tsx`
- Archived threads settings view: `src/app/components/settings/ArchivedThreadsPanel.tsx`, `src/app/components/sidebar/SettingsMenu.tsx`
- Project create/import actions are wired through the desktop backend, even though surrounding UX/semantics are still partial: `desktop/pi-threads/project-actions.cts`, `src/app/components/sidebar/projects/SidebarProjectsSection.tsx`, `src/app/views/LandingView.tsx`, `src/app/views/settings/useSettingsController.ts`
- Shared Pi thread/message mapping is real and deduplicated: `shared/pi-message-mapper.ts`, `desktop/runtime/thread-publisher.cts`, `desktop/pi-threads/thread-loader.cts`
- Assistant thinking/reasoning traces are now rendered from Pi assistant content blocks, auto-expanded while streaming and collapsed after the turn completes: `shared/pi-message-mapper.ts`, `src/app/components/common/ThreadMessage.tsx`, `src/app/components/workspace/thread/VirtualizedThreadTimeline.tsx`
- Desktop action coverage is explicit and test-backed: `shared/desktop-action-coverage.ts`, `src/test/desktop-action-coverage.test.ts`

---

## Stubbed features by area

### 1. Composer / message sending

**Status:** Partially real.

- Controlled composer state exists in renderer and the surface is now split into prompt-vs-git-ops mock states for easier iteration: `src/app/components/workspace/Composer.tsx`, `src/app/components/workspace/composer/*`
- Send is wired through real Pi sessions with per-cwd runtimes: `desktop/runtime/*`, `desktop/pi-threads/action-router.cts`
- File picker attachments are wired and text/image files are sent through the Pi prompt path: `src/bun/index.ts`, `desktop/runtime/attachments.cts`, `src/app/components/workspace/Composer.tsx`
- Existing thread continuation is real via runtime session activation: `desktop/runtime/runtime-registry.cts`
- Streaming thread updates are pushed over Electrobun RPC messages and rendered live: `src/bun/index.ts`, `src/app/desktop/electrobun-api.ts`, `src/app/app-shell/useAppShellController.ts`
- Real model + thinking selectors are wired to Pi session state: `desktop/runtime/composer-state.cts`, `src/app/components/workspace/Composer.tsx`
- Composer now surfaces backend/model errors inline, including image-attachment incompatibility with non-image models: `desktop/runtime/composer-service.cts`, `src/app/components/workspace/Composer.tsx`
- Still stubbed in this area:
  - `composer.dictate`
  - `composer.host`
  - composer-adjacent git ops surface is mock-only and intentionally unwired for now
  - Source of truth: `shared/desktop-actions.ts`, `shared/desktop-action-coverage.ts`, `desktop/pi-threads/action-router.cts`

**Expansion direction:**
- Add attachment/image flows.
- Improve attachment handling to match Pi CLI file processing more closely (auto-resize, binary rejection, richer previews).
- Expand failure UX beyond inline composer text (retry affordances, auth-specific actions).
- Continue tightening live-turn fidelity beyond the current prose + reasoning + tool rendering.
- Replace the current mock git ops surface with a git-native worktree/project diff + commit flow instead of extending the current per-turn checkpoint model.

### 2. New thread creation

**Status:** Partially real.

- “New thread” now creates a fresh Pi session context for the selected project and returns the UI to home: `src/app/components/sidebar/Sidebar.tsx`, `desktop/runtime/composer-service.cts`, `desktop/pi-threads/action-router.cts`
- Session persistence still happens on first assistant-backed send, matching Pi session behavior.

**Expansion direction:**
- Decide whether desktop should ever force eager on-disk session creation before first assistant response.

### 3. Project actions menu

**Status:** Partially real.

- UI menu: `src/app/components/sidebar/ProjectActionMenu.tsx`
- Real actions now exist for:
  - open in file manager
  - edit display name in the app index
  - archive all project threads in the app index
  - remove/hide project from the sidebar index
- Files:
  - `src/app/components/sidebar/ProjectActionMenu.tsx`
  - `src/app/components/sidebar/ProjectActionDialog.tsx`
  - `src/app/app-shell/useAppShellController.ts`
  - `desktop/pi-threads/action-router.cts`
  - `desktop/thread-state-db/*`
- Still stubbed:
  - `project.create-worktree`

**Expansion direction:**
- Worktree creation remains deferred.

### 4. Sidebar utility controls

**Status:** Partially real.

- Project create/add is real via `project.add`: `src/app/components/sidebar/projects/SidebarProjectsSection.tsx`, `desktop/pi-threads/project-actions.cts`
- Project import scan/apply is real and currently used from landing/settings flows: `src/app/views/LandingView.tsx`, `src/app/views/settings/useSettingsController.ts`, `desktop/pi-threads/project-actions.cts`
- Thread/project filtering now exists as renderer-local UI state in the sidebar and inbox rather than as a real backend action:
  - `src/app/components/sidebar/projects/SidebarProjectsSection.tsx`
  - `src/app/components/sidebar/projects/sidebar-projects.helpers.ts`
  - `src/app/components/sidebar/inbox/SidebarInboxSection.tsx`
- Still stubbed / legacy inventory:
  - `threads.filter` remains a backend no-op legacy action ID
  - thread filtering/search is not yet a coherent end-to-end product flow

**Expansion direction:**
- Finish the current search/filter UX as an explicit product flow instead of a renderer-local helper only.
- Tighten project create/import semantics and surrounding UX now that the backend handlers exist.
- Project ordering now supports intentional drag-and-drop. If thread ordering becomes important later, add it as an explicit product rule instead of layering ad hoc pointer logic onto the current sidebar.

### 5. Header controls

**Status:** Layout now matches Codex more closely, but most controls are still stubbed except local pane toggles.

- `feature:header.*` status IDs are currently kept as trace-only inventory while the header is out of the product.

- Header-era controls are now split across `src/app/app-shell/AppShellWorkspace.tsx`, `src/app/components/workspace/composer/ComposerGitOpsSurface.tsx`, and `src/app/components/workspace/TerminalPanel.tsx`
- Selected-project git detection is real and drives which header variant renders: `desktop/project-git.cts`, `src/app/app-shell/useAppShellController.ts`
- Codex-style structure now differs by view:
  - non-git: run action, open split button, terminal, diff, popout
  - git-backed projects: run action, open split button, handoff, commit split button, terminal, diff, inline diff stats, popout
  - thread: title + project switcher + thread actions on the left, controls on the right
- Local reducer-backed only:
  - terminal toggle
  - diff toggle
- Stubbed actions:
  - `thread.actions`
  - `thread.run-action`
  - `workspace.open`
  - `workspace.open-options`
  - `workspace.handoff`
  - `workspace.popout`

**Expansion direction:**
- Add real thread action menu.
- Define open split-button behavior in the Bun desktop bridge.
- Expand commit controls beyond the current project git surface wiring (branch switching is still display-only, and the diff lane is still on the older turn-based path).
- Define real handoff behavior.
- Replace mock home diff stats with real workspace diff data when the diff lane is implemented.

### 6. Landing page / project switcher

**Status:** Partially real.

- UI: `src/app/views/LandingView.tsx`
- Real project picker opens from the landing surface, selects a project, and starts a real thread via `thread.new`
- Latest-project affordance also starts a real thread
- Legacy `landing.project-switcher` still exists as a no-op action/status-inventory ID, but it is not the actual implementation path used by the UI

**Expansion direction:**
- Keep project switching as ordinary UI selection/thread-start flow rather than a separate desktop action.

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

**Status:** Partially real.

- UI: `src/app/components/workspace/DiffPanel.tsx`
- Diff renderer stack now ports the main t3code pattern:
  - `src/app/components/workspace/diff/DiffWorkerPoolProvider.tsx`
  - `src/app/components/workspace/diff/DiffPanelContent.tsx`
  - `src/app/components/workspace/diff/diff-rendering.ts`
- Backend checkpoint/diff pipeline now exists in:
  - `desktop/diff/checkpoint-store.cts`
  - `desktop/diff/query.cts`
  - `desktop/diff/summary-parser.cts`
- The thread lane now surfaces per-assistant changed-file summaries and can open the diff panel for a selected turn/file.

**Still partial because:**

- checkpoint capture currently runs for completed composer turns only, not every possible Pi session mutation path
- no placeholder/retry checkpoint lifecycle like t3code's full orchestration stack
- no sheet/mobile diff layout yet
- `diff.review` remains a shell action

**Expansion direction:**
- Extend checkpoint capture to additional turn-completion paths such as takeover session reconciliation if needed.
- Add richer diff review actions once a review/run-log model exists.
- Current product direction is under review: we are mocking a simpler composer-adjacent git ops flow that would treat diffs as project/worktree state since the last commit instead of leaning harder into per-turn checkpoint history.

### 9. Terminal panel

**Status:** Partially real.

- UI: `src/app/components/workspace/TerminalPanel.tsx`, `src/app/components/workspace/terminal/TerminalViewport.tsx`
- Renderer now uses real `xterm.js` + fit addon and streams keystrokes/output over the desktop bridge.
- Takeover mode now swaps the thread pane for a composer-lite `Pi desktop` surface that embeds the native Pi TUI in the same centered `744px` lane as the thread/composer view.
- Backend PTY/session manager exists in:
  - `desktop/terminal/manager.cts`
  - `desktop/terminal/bun-pty.cts`
  - `desktop/terminal/node-pty.cts`
  - `shared/terminal-contracts.ts`
  - `src/bun/index.ts`
- Bun PTY is used on POSIX Electrobun runs; `node-pty` remains as the Windows fallback.
- Transcript history is persisted per session and replayed on reopen.
- Still partial because:
  - only one terminal is surfaced per current project/thread context
  - no split panes / multi-terminal session UI yet
  - no path-to-editor link opening yet; only external URL links are handled

**Expansion direction:**
- Add multi-terminal/session controls if Codex parity needs them.
- Add path link detection + open-in-editor behavior.
- Decide whether terminal should stay project/thread-scoped or grow into a richer run-log/PTY hybrid.

### 9a. Thread scroller behavior

**Status:** Partially real.

- UI: `src/app/views/ThreadView.tsx`, `src/app/views/MainView.tsx`, `src/app/app-shell/AppShellLayout.tsx`
- The centered thread lane now owns its own scrollbar instead of using the far-right workspace scrollbar, and the visible message DOM renders in natural document flow so chat rows keep their real measured height.
- Message rendering now lazy-loads from latest to earliest, with an earlier-messages divider used to reveal older content.
- Live updates only auto-follow when the user is already near the bottom of the thread; scrolling in the middle preserves the user's position.

**Still partial because:**
- the lazy window is renderer-local only; there is no server-side/page-based thread hydration yet
- earlier-message paging is size-based rather than semantic chunking or date grouping

**Expansion direction:**
- Move from fixed-size client paging to explicit branch/page hydration if very large Pi sessions require it.

### 10. Remote connections banner on home

**Status:** Visual only.

- UI: `src/app/components/workspace/Composer.tsx`
- Stub actions:
  - `connections.add`
  - `connections.dismiss-banner`

**Expansion direction:**
- Replace with real remote host/account state or remove if not planned.

### 11. Product / settings items that are just shells

**Status:** Mixed: some real navigation, some shell-only inventory.

- Settings popup UI: `src/app/components/sidebar/SettingsMenu.tsx`
- Real navigation entries now exist for:
  - Skills
  - Extensions
  - Archived threads
  - App settings
- Still just UI shells:
  - Rate limits remaining

**Expansion direction:**
- Either route through actual desktop settings screens or reduce surface area until implemented.

### 12. Thread metadata / message fidelity

**Status:** Improved, still partial.

- Thread mapping now includes:
  - user messages
  - assistant messages
  - tool results
  - bash execution entries
  - custom messages
  - branch summaries
  - compaction summaries
  - files: `shared/pi-message-mapper.ts`, `desktop/runtime/thread-publisher.cts`, `desktop/pi-threads/thread-loader.cts`, `src/app/components/common/ThreadMessage.tsx`
- Still simplified:
  - tool calls are not rendered as their own in-progress blocks
  - assistant thinking is rendered, but still uses a minimal desktop block instead of Pi TUI parity
  - image attachments are shown as text placeholders, not inline previews
- `previousMessageCount` is now derived from Pi compaction metadata on the active branch: `shared/pi-message-mapper.ts`, `desktop/pi-threads/thread-loader.cts`, `desktop/runtime/thread-publisher.cts`

**Expansion direction:**
- Add explicit live tool-call state blocks during streaming.
- Render inline image previews / richer custom-message layouts where appropriate.

### 13. Thread creation / continuation lifecycle

**Status:** Partially real.

- Existing thread indexing/opening is real
- Explicit `thread.new` is real
- Landing project picking also starts work through the same real `thread.new` path
- Existing-thread follow-up prompting is real
- Live assistant streaming into the open thread is real
- Sidebar/thread cache refresh after send is real
- Session creation semantics are still slightly split between explicit new-thread setup and first-send/runtime activation behavior

**Still missing / incomplete:**

  - richer streamed tool/bash/custom-message fidelity
  - clearer failure / retry UI

**Key files:**
- `src/app/components/workspace/Composer.tsx`
- `src/app/hooks/useDesktopThread.ts`
- `desktop/pi-threads/thread-loader.cts`
- `desktop/pi-threads/action-router.cts`

### 14. Contract-only / no-op actions that still need cleanup

These currently exist in the action contract but are still no-op inventory rather than meaningful product behavior:

- no-op and largely legacy / unsurfaced:
  - `threads.filter`
  - `landing.project-switcher`
- no-op but still surfaced in current UI:
  - `workspace.open`
  - `workspace.open-options`
  - `workspace.handoff`
  - `workspace.popout`
  - `diff.review`

Sources: `shared/desktop-actions.ts`, `shared/desktop-action-coverage.ts`, `desktop/pi-threads/noop-actions.cts`

---

## Mock data that still exists

- Card surfaces still use mock data: `src/app/data/mock-data.ts`
- Reducer tests also use mock project fixtures from the same file: `src/app/state/workspace.test.ts`

This is fine for tests, but the card/view content is still placeholder product scaffolding.

---

## Good next expansion order

1. Finish the remaining non-chat parts of the composer flow (host/dictate)
2. Header/project-switch/product-menu implementation
3. Finish diff review + converge diff ownership with the intended git/worktree product model
4. Finish terminal/host/remote/handoff semantics instead of treating them as separate partial shells
5. Replace plugin/automation/debug mock cards with real registries or remove until ready
6. Improve thread rendering fidelity for tool results and non-chat session entries
