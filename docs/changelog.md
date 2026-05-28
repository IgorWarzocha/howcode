### 0.1.67

- Future release. New work from here is meant to ship as 0.1.67.
- Updated bundled Pi SDK/runtime packages to 0.76.0.
- Branch/worktree creation now normalizes messy names like `fix sidebar` into Git-safe names like `fix-sidebar`.
- Inline branch actions can now create a child worktree under that branch.
- Sidebar branch/worktree/project changes now patch in place instead of refetching the whole shell state.

Snapshot: TBD.

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

Snapshot: May 19, 2026.

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

Snapshot: May 15, 2026.

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

Snapshot: May 10, 2026.

### 0.1.61-6x hotfixes

- ASAR is back. And then it disappeared. And it's back again.
- Repaired launcher installs missing `app.asar`.
- Unpacked runtime host dependencies for external Node.
- Fixed HTML and React artifact previews.
- Isolated markdown editor dependencies from HTML and React artifacts.
- Fixed React artifact hooks and import handling.

Snapshot: May 7, 2026.

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

Snapshot: May 7, 2026.

### 0.1.5

- Added GUI support for Howcode and Pi JSON themes.
- Fixed Pi TUI takeover jumpiness.
- Fixed composer follow-ups opening in the wrong session.
- Fixed tooltips clipping near window edges.

Snapshot: May 4, 2026.

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

Snapshot: May 3, 2026.

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

Snapshot: April 29, 2026.
