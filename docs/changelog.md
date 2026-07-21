### 0.1.68

- Rebuilt app updates around one atomic, channel-aware updater for macOS, Linux, and Windows.
- Updates now download in the background, verify immutable archives, and hand off before the next launch.
- Hardened `bunx howcode` / `bunx howcode@dev` cache recovery, concurrent launches, and launch failure reporting.
- Existing release manifests remain readable for this migration release; future manifests use protocol v2.

Snapshot: 21 July 2026.

### 0.1.67


- Added **server** headless/browser mode. Use `howcode --server --host 0.0.0.0 --token xyz`. The app is usable in a mobile browser if you wish to do so.
- Added native Smart BTW extension, and subsequently removed it, because...
- Howcode now uses new Pi SDK to render dialogs, widgets, statuslines and notifications.
- Extensions pass through shortcuts.
- Right Alt no longer triggers app or extension shortcuts.
- Fancy react-rendered extensions not supported yet. Only normal-ish widgets.
- Implemented /tree functionality with labelling and summarisation.
- Split Pi TUI takeover and the terminal drawer properly.
- Shortcut handling improved when Pi TUI is on.
- Resolved an annoying bug that didn't allow typing into Pi TUI.
- Added Pi project trust prompts in desktop, backed by Pi's trust store.
- Reworked widgets, dialogs, attachments, `/commands` to feel like a coherent stack.
- Extension widgets no longer shake the thread view.
- Inbox keeps branch-assigned threads in Code context.
- Thread URLs no longer stick to local draft ids.
- Sidebar sessions can be renamed inline now.
- Rebuilt the workspace rails around the composer/thread. Better responsiveness.
- Fixed the empty composer being taller than a composer with text in it.
- Compaction status now stays above composer widgets.
- Fixed Past sessions count alignment in the sidebar.
- Fixed macOS window dragging and native Cmd+A select-all.
- Updated Pi SDK/runtime packages to 0.79.6.
- Bumped app/build dependencies.

Snapshot: 12 June 2026.

#### 0.1.66 Hotfixes (because .67 has to be more special)

- Branch/worktree creation now normalizes messy names with spaces into Git-safe names.
- Inline branch actions can now create a child worktree under that branch.
- Child worktrees keep their recorded parent branch after dev/app restart.
- Worktrees can only be created from the active branch.
- Sidebar branch/worktree actions now show an in-place spinner while they are running.
- Sidebar changes now patch in place instead of refetching the whole shell state.
- Reasoning block headers no longer dump raw CoT when a model does not provide headers.
- Theme changes now apply instantly instead of waiting for a full shell refresh.
- Fixes to light modes
- Dictation controls now hide while composer inputs are locked.
- Tiny composer widths now keep the Terminal icon visible instead of dropping the whole control.
- Git diffs use remote HEAD as the default branch.
- Git diffs add parent-branch baseline and drop Yesterday.
- Updated bundled Pi SDK/runtime packages to 0.76.0.

Snapshot: 28 May 2026.

### 0.1.66

- Split desktop Pi/runtime work into a stock-Node service so native deps stop fighting Electron.
  *Reason being that Pi compiles your extensions against your system Node. Things were getting messy. The app is compiled to work with Node 24, 25 and 26.*
- Rebuilt the project sidebar into a proper git-oriented work surface.
- Branches: start sessions, assign/unassign sessions, remove branches.
- Worktrees: create, start sessions inside them, mark complete, merge/remove.
- Branches + worktrees: one-click merge/remove completed worktrees.
  *Please note some of these actions are irreversible. Safeguards around errors, but if it succeeds, they're gone.*
- De-cardified a lot of the UI: quieter chat/tool rows, composer popovers, Skills/Extensions, Settings, Inbox, artifacts, and GitOps diffs.
- Project dashboard is now it's separate thing, not connected to starting a session anymore.
- Split up app shell, composer, terminal, GitOps, inbox, settings, artifacts, and runtime-host code.
- Added cleaner app module boundaries with `@howcode/*` aliases and native capability folders. First step to pluginisation of the app.
- Upgraded GitOps diffs to use Pierre's streamed CodeView renderer.
- GitOps now shows image previews.
- Made GitOps diffs less likely to freeze the UI.
- Added configurable app keybindings. More coming soon™
- Added custom Pi directory settings.
- Added thread find and result highlights.
- Updated dependencies.
- Edit tool now displays diffs.
- Sidebar fold/unfold button placement moved around.
- Fixed packaged macOS terminal startup (thank you, BlockedPath).
- Fixed dev-channel updater checks getting stuck on stale archives.
- Fixed same-version update hash checks.
- Fixed new project threads vanishing during refreshes.
- Fixed code landing/project dashboard routing.
- Fixed empty dashboard threads piling up.
- Fixed Pi TUI new-thread sidebar handoff.
- Cleaned up sidebar popovers and project-work styling.
- Quieted missing-session noise and checkbox jumps.
- Fixed extension summaries locking the composer.

Snapshot: 27 May 2026.

### 0.1.65

- Added sidebar project search.
- Added inbox actions for local sessions.
- Added clickable model/provider selection in the footer.
- Improved Pi message status details.
- Improved artifact preview controls and artifact panel interactions.
- Improved GitOps composer polish and diff baseline controls.
- Improved sidebar favorites, project icons, and project ordering.
- Polished compact composer controls, including dictation button placement.
- Fixed extension-backed models in draft composer selection.
- Fixed updater rechecks, self-update detection, and launcher download timeouts.
- Fixed a bunch of small sidebar, composer, GitOps, and artifact rough edges.

Snapshot: 15 May 2026.

### 0.1.64

- Added copy controls to chat and reasoning messages.
- Made chat text selection less annoying. Dragging over messages should not collapse them.
- Improved wrapping for long markdown, links, and awkward agent output.
- Polished compact composer controls.
- Added a working-state stop button animation. It looks properly agitated when the agent is busy.
- Smoothed composer resizing, textarea scrolling, and bottom anchoring.
- Added an in-app folder browser for adding projects.
- Added project creation and GitHub clone flows from the selected folder.
- Fixed folder browser edge cases around stale loads and Git initialization.
- Added targeted Settings routing for setup prompts.
- Dictation setup now opens the right Settings section instead of leaving you to hunt for it.
- Missing project location setup now points at the right Settings card.
- Fixed persisted chats overriding each other’s model/thinking choices.
- Surfaced Pi stop states, model/reasoning changes, and extension errors in chat.
- Added token, cache, and cost totals to the context popover.
- Made live tool calls show running state and arguments sooner.
- Added `/new` in the composer.
- Fixed compact terminal/sidebar behavior, including Pi TUI takeover fold-button alignment.
- Improved macOS window chrome and quit behavior.

Snapshot: 10 May 2026.

### 0.1.61-6x hotfixes

- ASAR is back. And then it disappeared. And it's back again.
- Repaired launcher installs missing `app.asar`.
- Unpacked runtime host dependencies for external Node.
- Fixed HTML and React artifact previews.
- Isolated markdown editor dependencies from HTML and React artifacts.
- Fixed React artifact hooks and import handling.

Snapshot: 7 May 2026.

### 0.1.6

- Added responsive layouts everywhere-ish.
- Added fuzzy file mentions in the composer using `@`.
- Added `$skill` mentions in the composer.
- Hardened Chat mode filesystem and extensions guardrails.
- Added a custom system prompt to Chat mode.
- Added scrollable composer input.
- Added more visible Git errors. Please report any.
- Terminal is back on xterm, because addon-fit.
- ASAR is back.
- TS6 fully implemented.
- Added new CI with super strict Biome and typechecking.
- Now on `@earendil-works` packages. RIP.
- https://igorwarzocha.github.io/howcode/ is now live.

Snapshot: 7 May 2026.

### 0.1.5

- Added GUI support for Howcode and Pi JSON themes.
- Fixed Pi TUI takeover jumpiness.
- Fixed composer follow-ups opening in the wrong session.
- Fixed tooltips clipping near window edges.

Snapshot: 4 May 2026.

### 0.1.4

- Added Chat mode: just chat, with artifacts and minimal tools.
- Added GitOps changed-files tree for faster diff review navigation.
- Polished composer controls, model picker menus, sidebar modes, and settings groups.
- Added a native ask-questions extension, works in both desktop and tui.
- Added in-app update detection and restart flow.
- Upgraded the terminal renderer to Ghostty via WTerm 0.3.0.
- Added loading skeletons across workspace surfaces.
- Fixed clean desktop shutdown.
- Updated Pi packages to 0.72.1.

Snapshot: 3 May 2026.

### 0.1.3

- Moved Pi runtime work to external stock-Node hosts.
- Improved headless extension commands: args, errors, cancellation, and non-blocking runs.
- Fixed Windows launcher/install relaunch flow.
- Added GitOps commit/push feedback and persisted GitOps defaults.
- Added project import from GitHub repo links.
- Persisted Git diff defaults and per-session diff overrides.
- Fixed settings layout overflow and spacing.
- Stabilized terminal drawer and Pi TUI takeover behavior.
- Updated WTerm to 0.2.1.
- Streamed live runtime tool/subagent progress into the transcript.
- Kept composer content visible during send handoff.
- Fixed pasted image paths and screenshot clipboard attachments.

Snapshot: 29 April 2026.
