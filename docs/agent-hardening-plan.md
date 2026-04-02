# Agent hardening and UI traversability plan

This plan captures the next hardening pass for the repo using the `agent-native-hardening` lens.

Primary goals:

1. split godfiles into single-purpose modules
2. improve traversability for humans and agents
3. make UI controls easier to discover and operate via accessibility semantics and CDP

## Baseline scorecard

| Category | Score | Evidence |
| --- | ---: | --- |
| `agent_native` | 5/10 | good shared contracts and lane map, but several orchestration hubs own too many behaviors |
| `fully_typed` | 7/10 | strict TS is enabled in renderer and electron configs |
| `traversable` | 4/10 | large mixed-responsibility files and duplicated message-mapping logic increase reread cost |
| `test_coverage` | 3/10 | deterministic reducer tests exist, but extracted pure helpers are not broadly covered |
| `feedback_loops` | 8/10 | `check`, lint, typecheck, test, build, and pre-commit hooks are already wired |
| `self_documenting` | 6/10 | README and lane map exist, but some files no longer match the documented ownership model |

## High-priority findings

### P0: split first

#### 1. `electron/pi-desktop-runtime.cts`

Current mixed responsibilities:

- runtime module loading and caching
- runtime/session activation
- message/title mapping
- attachment file ingestion
- live thread publishing and desktop event emission
- composer actions

Evidence:

- `electron/pi-desktop-runtime.cts:43-55`
- `electron/pi-desktop-runtime.cts:182-218`
- `electron/pi-desktop-runtime.cts:220-316`
- `electron/pi-desktop-runtime.cts:340-407`
- `electron/pi-desktop-runtime.cts:430-513`

Target split:

- `electron/runtime/runtime-registry.cts`
- `electron/runtime/message-mappers.cts`
- `electron/runtime/attachments.cts`
- `electron/runtime/thread-publisher.cts`
- `electron/runtime/composer-service.cts`

Definition of done:

- `pi-desktop-runtime.cts` becomes a thin facade/orchestrator
- message mapping exists in one shared place only
- publish flow and composer flow are independently readable

#### 2. `src/app/AppShell.tsx`

Current mixed responsibilities:

- reducer wiring and derived state
- async bootstrap and reload effects
- desktop event subscription
- action post-processing and side effects
- top-level layout composition

Evidence:

- `src/app/AppShell.tsx:25-77`
- `src/app/AppShell.tsx:78-148`
- `src/app/AppShell.tsx:150-183`
- `src/app/AppShell.tsx:185-245`
- `src/app/AppShell.tsx:275-369`

This conflicts with `docs/lane-map.md:7-9`, which says `AppShell` should be top-level composition only.

Target split:

- `src/app/app-shell/useAppShellController.ts`
- `src/app/app-shell/useDesktopEventSync.ts`
- `src/app/app-shell/useComposerSync.ts`
- `src/app/app-shell/AppShellLayout.tsx`

Definition of done:

- `AppShell.tsx` mostly wires a controller to a layout
- async effect clusters are moved into focused hooks
- action routing is readable without scanning render markup

#### 3. `electron/thread-state-db.cts`

Current mixed responsibilities:

- database path/bootstrap/schema ownership
- row-to-domain mapping
- relative-age formatting
- read queries
- write commands and mutations

Evidence:

- `electron/thread-state-db.cts:62-92`
- `electron/thread-state-db.cts:94-138`
- `electron/thread-state-db.cts:140-148`
- `electron/thread-state-db.cts:150-310`
- `electron/thread-state-db.cts:312-440`

Target split:

- `electron/thread-state-db/db.cts`
- `electron/thread-state-db/schema.cts`
- `electron/thread-state-db/queries.cts`
- `electron/thread-state-db/writes.cts`
- `electron/thread-state-db/mappers.cts`

Definition of done:

- schema/bootstrap code is isolated
- queries and writes are no longer interleaved
- presentation formatting is not mixed into storage code unless intentionally shared

### P1: split next

#### 4. `electron/pi-threads.cts`

Current mixed responsibilities:

- shell loading
- session discovery and indexing
- cached/live thread hydration
- desktop action routing

Evidence:

- `electron/pi-threads.cts:168-223`
- `electron/pi-threads.cts:234-276`
- `electron/pi-threads.cts:278-417`

Important follow-up:

- deduplicate message/title mapping shared with `electron/pi-desktop-runtime.cts`

Target split:

- `electron/pi-threads/shell-loader.cts`
- `electron/pi-threads/thread-loader.cts`
- `electron/pi-threads/action-router.cts`

#### 5. `src/app/components/workspace/Composer.tsx`

Current mixed responsibilities:

- home banner
- attachment state and chips
- draft/send workflow
- model picker popup
- thinking-level popup
- footer action strip

Evidence:

- `src/app/components/workspace/Composer.tsx:69-101`
- `src/app/components/workspace/Composer.tsx:103-131`
- `src/app/components/workspace/Composer.tsx:133-201`
- `src/app/components/workspace/Composer.tsx:203-247`
- `src/app/components/workspace/Composer.tsx:249-287`
- `src/app/components/workspace/Composer.tsx:312-325`

Target split:

- `src/app/components/workspace/composer/ComposerBanner.tsx`
- `src/app/components/workspace/composer/AttachmentChips.tsx`
- `src/app/components/workspace/composer/ModelMenu.tsx`
- `src/app/components/workspace/composer/ThinkingMenu.tsx`
- `src/app/components/workspace/composer/useComposerController.ts`

#### 6. `src/app/components/sidebar/ProjectTree.tsx`

Current mixed responsibilities:

- popup menu dismissal state
- project row rendering
- project actions cluster
- thread row rendering/actions
- empty state rendering

Evidence:

- `src/app/components/sidebar/ProjectTree.tsx:39-51`
- `src/app/components/sidebar/ProjectTree.tsx:55-150`
- `src/app/components/sidebar/ProjectTree.tsx:152-233`

Target split:

- `src/app/components/sidebar/project-tree/ProjectRow.tsx`
- `src/app/components/sidebar/project-tree/ThreadRow.tsx`
- `src/app/components/sidebar/project-tree/useProjectMenuDismiss.ts`
- `src/app/components/sidebar/project-tree/EmptyThreadsState.tsx`

## Files to leave alone for now

- `src/app/state/workspace.ts`: focused reducer/selectors and already covered by `src/app/state/workspace.test.ts`
- `electron/main.cts`: mostly IPC registration; revisit only after Electron domain modules are cleaner

## Recommended implementation order

### Lane A: shared Electron thread/message utilities

- extract shared title normalization and message mapping
- make `pi-desktop-runtime.cts` and `pi-threads.cts` consume the same helpers
- add small deterministic tests for the shared pure helpers

### Lane B: database layer split

- isolate DB bootstrap and schema
- separate read queries from writes
- keep the public API stable while moving internals first

### Lane C: runtime/composer split

- isolate runtime registry
- isolate attachment processing
- isolate thread publishing and desktop event emission
- keep one thin public entry module

### Lane D: AppShell controller split

- move effect clusters into hooks
- move action post-processing into a controller/hook
- keep layout rendering in a separate component

### Lane E: UI decomposition

- split `Composer.tsx` and `ProjectTree.tsx`
- prefer small presentational pieces and one stateful controller per cluster

## General refactor rules

- prefer one reason to change per module
- prefer pure helpers over inline duplicated transforms
- keep public contracts in `shared/` stable while refactoring behind them
- add comments only for invariants, side effects, and non-obvious control flow
- keep deterministic tests close to extracted pure logic

## UI ARIA and agent traversability audit

This app is already better than average for automation because many controls are real `<button>` or `<textarea>` elements. That said, the UI is still visual-first in several places. For CDP-driven repair and operation, we want stable names, state, landmarks, and popup semantics.

### Current strengths

- semantic main region exists in `src/app/AppShell.tsx:323-330`
- sidebar uses `<aside>` and navigation uses `<nav>` in `src/app/components/sidebar/Sidebar.tsx:62-67,87-117`
- icon-only buttons often have explicit labels via `IconButton`
- composer input is a real `<textarea>` in `src/app/components/workspace/Composer.tsx:154-169`
- send, close, and utility actions are mostly proper buttons rather than clickable divs

### Biggest accessibility/traversability gaps

#### 1. Modal overlay lacks dialog semantics

File:

- `src/app/components/settings/ArchivedThreadsPanel.tsx:25-102`

Problems:

- no `role="dialog"`
- no `aria-modal="true"`
- no accessible name linked to the title
- no visible focus management or escape-to-close behavior

Why it matters for agents:

- CDP agents cannot reliably query for a dialog landmark
- focus may remain behind the overlay, making scripted interaction brittle

Recommended fix:

- add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- give the title an `id`
- move focus into the panel on open and restore it on close
- support Escape close

#### 2. Popup menus are visual surfaces, not semantic menus

Files:

- `src/app/components/sidebar/ProjectActionMenu.tsx`
- `src/app/components/sidebar/SettingsMenu.tsx`
- `src/app/components/workspace/Composer.tsx:203-287`
- `src/app/components/workspace/WorkspaceHeader.tsx:72-81`

Problems:

- trigger buttons do not expose `aria-haspopup`, `aria-expanded`, or `aria-controls`
- popup containers do not expose `role="menu"`
- menu items are just plain buttons with no menu role pattern

Why it matters for agents:

- agents must infer popup state from DOM position or CSS instead of role/state queries
- keyboard and screen reader behavior is less predictable

Recommended fix:

- for each trigger, add `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls`
- for each popup, add `role="menu"`
- use `role="menuitem"` on actionable items if you keep the menu pattern
- close on Escape and outside click consistently

#### 3. Expand/collapse and selection state is not exposed enough

Files:

- `src/app/components/sidebar/ProjectTree.tsx:71-92`
- `src/app/components/sidebar/ProjectTree.tsx:94-110`
- `src/app/components/sidebar/ProjectTree.tsx:155-224`
- `src/app/components/common/NavButton.tsx`

Problems:

- project expand/collapse button has a label but no `aria-expanded`
- no `aria-controls` relationship between project button and thread group
- active nav/project/thread state is mostly visual only

Why it matters for agents:

- agents cannot easily ask “which project is expanded?” or “which item is active?”

Recommended fix:

- add `aria-expanded` and `aria-controls` to project toggles
- give each thread group a stable `id`
- use `aria-current`, `aria-selected`, or a list/tree pattern for the active item state

#### 4. Major regions could use stronger labels

Files:

- `src/app/components/sidebar/Sidebar.tsx:62-167`
- `src/app/components/sidebar/Sidebar.tsx:119-152`
- `src/app/components/workspace/WorkspaceHeader.tsx:39-108`
- `src/app/components/workspace/TerminalPanel.tsx`

Problems:

- landmarks exist, but some are unnamed
- thread section is a generic section with visible text but no heading association
- terminal panel likely needs its own label/region semantics

Why it matters for agents:

- labeled landmarks make DOM targeting much more stable than text-only traversal

Recommended fix:

- give `<aside>` an `aria-label`, e.g. `Workspace sidebar`
- give the threads section `aria-labelledby`
- make the terminal panel a labeled `section` or `region`

#### 5. Hover-revealed controls reduce deterministic discoverability

Files:

- `src/app/components/sidebar/ProjectTree.tsx:112-141`
- `src/app/components/sidebar/ProjectTree.tsx:167-223`

Problems:

- project and thread actions are easiest to discover only when hovered or selected

Why it matters for agents:

- CDP can still click them, but traversal becomes more layout-sensitive and less state-driven

Recommended fix:

- ensure actions are available via focus as well as hover
- keep stable labels even when visually hidden
- prefer explicit row action groups with discoverable state

## ARIA improvement order

### P0

1. archived threads dialog semantics and focus handling
2. popup/menu trigger semantics for project settings and composer menus
3. expanded/selected state on project tree and nav items

### P1

4. label all major landmarks and regions
5. make hover-only actions focus-discoverable
6. add stronger semantics around thread/message lists if streaming UX grows

## Accessibility definition of done

- every interactive control has a stable accessible name
- every popup trigger exposes open/closed state
- modal overlays are real dialogs with focus management
- active, selected, expanded, and pressed states are machine-readable
- agents can locate major regions by landmark and label instead of CSS structure
- a CDP script can open the app, navigate threads, send a prompt, open settings, and restore an archived thread using role/name/state queries alone
