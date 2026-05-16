# Keybindings implementation

Status: implemented on `keybindings-implementation`.

## Goals

- Ship a bundled set of Howcode keybindings that feel native to desktop coding apps.
- Let users customize bindings and persist their overrides in config.
- Keep the initial set small, mnemonic, and tied to Howcode concepts rather than copying every shortcut from other tools.
- Make shortcut handling context-aware so text entry, terminal focus, popovers, dialogs, and GitOps do not fight each other.

## References reviewed

- T3 Code local keybinding system:
  - `/home/igorw/Frameworks/t3code/KEYBINDINGS.md`
  - `/home/igorw/Frameworks/t3code/apps/server/src/keybindings.ts`
  - `/home/igorw/Frameworks/t3code/packages/contracts/src/keybindings.ts`
- Claude Code keybinding customization docs.
- Claude Desktop Quick Entry docs.
- Codex desktop/app shortcut references.

## Implementation model

Prefer a first-party keybinding layer rather than a large dependency.

Implemented shape:

- Define bundled command IDs and default accelerators in `shared/keybindings.ts`.
- Store user overrides in app config as command ID to accelerator/null.
  - Missing value: use bundled default.
  - String value: user override.
  - `null`: user disabled this command.
- Use Electron-compatible accelerator strings as the persisted format where possible.
- Add context/scope support so the same key can mean different things only when safe.
- Detect and report conflicts in Settings.
- Keep menu/native accelerators and renderer shortcuts resolved from the same registry.

T3 Code has a useful model worth borrowing:

- JSON rules.
- Optional `when` expressions.
- Invalid rule warnings instead of hard failure.
- Last matching rule wins.
- Auto-watch / reload config.

Claude Code has useful customization ideas:

- Context-specific blocks.
- `null` to unbind.
- Reserved shortcut concept.

## Proposed bundled defaults

| Command ID | Action | Default | Notes |
| --- | --- | --- | --- |
| `app.commandPalette` | Open command palette | `CmdOrCtrl+K` and `CmdOrCtrl+Shift+P` | Reserve now even if command palette ships later. `CmdOrCtrl+K` is common in modern AI/dev apps; `CmdOrCtrl+Shift+P` is VS Code muscle memory. |
| `settings.open` | Open settings | `CmdOrCtrl+,` | Native desktop convention. |
| `thread.new` | New thread | `CmdOrCtrl+N` | Keep this as the main default. Avoid extra aliases unless needed later. |
| `thread.find` | Find in current thread | `CmdOrCtrl+F` | Standard find behavior inside the active transcript/thread. |
| `sidebar.toggle` | Toggle sidebar | `CmdOrCtrl+B` | Common app convention and matches Codex. |
| `terminal.toggle` | Toggle terminal | `CmdOrCtrl+J` | Matches T3 Code and Codex. |
| `terminal.clear` | Clear focused terminal | `Ctrl+L` | Terminal-context only. On macOS, consider `Cmd+K` only when terminal has focus, but avoid stealing command palette globally. |
| `gitops.open` | Open/toggle GitOps | `CmdOrCtrl+G` | Howcode concept is GitOps, not a generic diff panel. |
| `gitops.toggleChangedFiles` | Toggle changed files in GitOps | `CmdOrCtrl+Shift+G` | Same mnemonic family as GitOps. Accepted tradeoff: may overlap with Find Previous conventions, so find UI should own it only while find is active if needed. |
| `thread.previousInProject` | Previous thread in current project | `CmdOrCtrl+Shift+[` | Constrain to current project to avoid disorienting cross-project jumps. |
| `thread.nextInProject` | Next thread in current project | `CmdOrCtrl+Shift+]` | Constrain to current project. |
| `composer.submit` | Submit prompt | `Enter` by default | Add a setting to switch to `CmdOrCtrl+Enter` to send. |
| `composer.newline` | Insert newline | `Shift+Enter` | If send mode is `CmdOrCtrl+Enter`, plain `Enter` should insert newline. |
| `agent.interrupt` | Interrupt active thread/run | `Escape Escape` | Double Escape only. Single Escape remains normal UI dismiss behavior. Active-thread/runtime context only. |
| `dictation.toggle` | Toggle dictation | `Ctrl+M` | Matches Codex dictation shortcut reference. |

## Explicit non-goals / deferred decisions

- Do not add generic `diff.toggle` as a default command. Howcode has GitOps and changed-files UI; use GitOps-specific commands.
- Do not add generic back/forward navigation yet. `CmdOrCtrl+[` and `CmdOrCtrl+]` should wait until Howcode has a clear history/navigation model.
- Do not make previous/next thread global across all projects. Scope it to the active project.
- Do not use single Escape for interrupt. It conflicts with native dismiss behavior for popovers, menus, autocomplete, and dialogs.

## Composer send mode

Add a setting separate from generic keybinding overrides:

- Default: Enter sends, Shift+Enter inserts newline.
- Optional mode: `CmdOrCtrl+Enter` sends, Enter inserts newline.

This is more than a shortcut override because it changes text editing semantics.

## Context rules

Initial context rules should include at least:

- `composerFocus`
- `terminalFocus`
- `threadActive`
- `agentRunning`
- `gitOpsOpen`
- `findOpen`
- `modalOpen`
- `popoverOpen`

Priority guidance:

1. Text inputs/composer own typing shortcuts.
2. Terminal owns terminal shortcuts when focused.
3. Find UI owns find navigation shortcuts while open.
4. Popovers/dialogs use single Escape for dismiss.
5. Double Escape can interrupt only when an agent is running in the active thread.
6. App-level shortcuts apply only after context-specific handlers decline.

## Decisions

- Config is edited through Settings first. The backend persists it in app preferences.
- Aliases are bundled only for command palette. User overrides are one accelerator or `null`.
- We use simple built-in context rules first, not full `when` expressions.
- Conflicts show inline in Settings, next to the shortcut that caused them.
