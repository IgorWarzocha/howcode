## Changelog

189 files changed, 9,707 lines added, 6,815 lines deleted, 16,522 total LoC changed.

In 2 days.

- Moved Pi runtime work out of Electron's bundled Node and into external stock-Node hosts.
- De-flickered the terminal drawer and Pi TUI takeover.
- Streamed live runtime tool/subagent progress into the transcript and preserved Pi custom/system messages.
- Made headless extension commands much more usable: `/commands` with args, visible errors, cancellable long runs, and composer stays usable while they run.
- Added clear GitOps commit/push feedback and persisted GitOps defaults, including per-project overrides.
- Persisted Git diff defaults and per-session diff overrides across the normal composer, GitOps composer, and Pi TUI takeover mini composer.
- Let the sidebar add projects from GitHub repo links, with clone progress and temporary top pinning for newly added projects.
- Made pasted image paths and raw screenshot clipboard attachments reliable, with cleanup for temporary clipboard images.
- Fixed the Windows launcher/install relaunch path with Start Menu shortcuts, cached command launching, and cleaner artifact names.
- Fixed settings layout overflow/cutoff, then tightened settings row spacing and action/icon alignment.
- Updated WTerm to 0.2.1 for the embedded terminal stack.

Snapshot: April 30, 2026.
