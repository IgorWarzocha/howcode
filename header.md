# Removed workspace header

The old top header bar has been removed from the app shell.

## Buttons that were present

- **Project switcher**
  - Show the current project name.
  - Planned action: switch between projects.

- **Thread actions**
  - Overflow menu button.
  - Planned action: open thread-level actions.

- **Run action**
  - Play button.
  - Planned action: configure or trigger a thread-specific run action.

- **Open**
  - Folder button.
  - Planned action: open workspace/project resources.

- **Open options**
  - Chevron next to Open.
  - Planned action: show alternate open targets or open-related menu options.

- **Handoff**
  - Arrow-left-right button.
  - Planned action: hand work off somewhere else, likely another environment, thread, or collaborator flow.

- **Workspace popout**
  - External-window button.
  - Planned action: open the workspace in a separate popout window.

## Notes

- The header looked mostly mock/planned rather than fully implemented.
- Several controls were status-tagged as `mock` in the codebase.
- Commit-related actions appear to have moved into the composer git surface instead of living in the top header.
