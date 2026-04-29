## Changelog

- Moved Pi runtime work out of Electron's bundled Node and into external stock-Node hosts, so native/extension bits stop fighting Electron's ABI.
- Made headless extension commands much more usable: `/commands` with args, visible errors, cancellable long runs, and composer stays usable while they run.
- Fixed the Windows launcher/install relaunch path with Start Menu shortcuts, cached command launching, and cleaner artifact names.
- Added clear GitOps commit/push feedback and persisted GitOps defaults, including per-project overrides.
- Let the sidebar add projects from GitHub repo links, with clone progress and temporary top pinning for newly added projects.
- Persisted Git diff defaults and per-session diff overrides across the normal composer, GitOps composer, and Pi TUI takeover mini composer.
- Fixed settings layout overflow/cutoff, then tightened settings row spacing and action/icon alignment.
- Stabilized the terminal drawer and Pi TUI takeover, including local-to-persisted session promotion and redraw/scroll behavior.
- Updated WTerm to 0.2.1 for the embedded terminal stack.
- Streamed live runtime tool/subagent progress into the transcript and preserved Pi custom/system messages.
- Kept composer content visible until send handoff completes, avoiding the blank gap before Pi starts responding.
- Made pasted image paths and Omarchy/raw screenshot clipboard attachments reliable, with cleanup for temporary clipboard images.

Snapshot: April 29, 2026.
