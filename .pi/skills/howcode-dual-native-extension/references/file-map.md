# Howcode Dual Native Extension File Map

Use these files as concrete references when adding a new dual-surface Howcode-native extension.

## Shared extension asset
- `desktop/native-extensions/howcode-native-ask-questions.mjs`
  - Owns the shared Pi tool schema, prompt snippet/guidelines, normalization, result formatting, and TUI UI.
  - Exports a default Pi extension factory for `pi --extension`.
  - Exports a named tool factory for desktop runtime-host adapters.

- `desktop/native-extensions/ask-questions-extension-path.cts`
  - Resolves the runtime-loadable extension path.
  - Handles dev/source path and packaged build path expectations.

- `scripts/build-electron-runtime.ts`
  - Copies `.mjs` native extension assets into `build/desktop/native-extensions/` for packaged/runtime builds.
  - In watch mode, re-copies native extension assets after edits, including watch events without a filename.

## Desktop runtime-host adapter
- `desktop/runtime-host/native-ask-questions-tool.cts`
  - Dynamically imports the shared `.mjs` extension.
  - Creates the desktop tool by passing `defineTool` and a desktop callback.
  - Keeps desktop-specific pending composer UI separate from shared tool behavior.

- `desktop/runtime-host/live-runtime-registry.cts`
  - Reads enabled native extensions per session.
  - Falls back from a missing snapshot row to current defaults and persists that legacy/session-first-materialized snapshot.
  - Registers native custom tools during session creation.
  - Publishes composer state when pending native tool state changes.

- `desktop/runtime/native-ask-questions-state.cts`
  - Worker-safe pending request state.
  - Resolves/rejects pending tool promises from composer actions.

## Main/DB boundary
- `desktop/thread-state-db/schema.cts`
  - Defines `session_native_extensions`.

- `desktop/thread-state-db/queries.cts`
  - Reads per-session native extension snapshots.

- `desktop/thread-state-db/session-writes.cts`
  - Writes per-session native extension snapshots.

- `desktop/runtime-host/protocol.cts`
  - Declares runtime-host ↔ main request types for session native extensions.

- `desktop/runtime-host/client-bridge.cts`
  - Implements main-side handlers for runtime-host requests.

## Settings
- `shared/desktop-settings-contracts.ts`
- `desktop/app-settings/keys.cts`
- `desktop/app-settings/readers.cts`
- `desktop/app-settings/writers.cts`
- `desktop/pi-threads/settings-actions.cts`
- `src/app/views/settings/settingsDescriptorCommon.tsx`
- `src/app/views/settings/useSettingsController.ts`
- `src/app/app-shell/controller-optimistic-updates.ts`

## Composer/UI
- `shared/desktop-composer-contracts.ts`
- `shared/desktop-action-contracts.ts`
- `shared/desktop-actions.ts`
- `shared/desktop-action-coverage.ts`
- `shared/pi-thread-action-payloads.ts`
- `desktop/runtime/composer-state.cts`
- `desktop/pi-threads/composer-actions.cts`
- `src/app/components/workspace/composer/ComposerPromptSurface.tsx`
- `src/app/components/workspace/composer/AskQuestionsCard.tsx`
- `src/app/components/workspace/composer/ComposerPromptInputPanel.tsx`
- `src/app/features/code/CodeWorkspaceView.tsx`
- `src/app/features/chat/ChatWorkspaceView.tsx`

## Pi TUI takeover
- `desktop/terminal/terminal-command.helpers.ts`
  - Adds `--extension <shared extension path>` for enabled native extensions when launching `pi --session ...`.

- `src/app/components/workspace/TerminalPanel.tsx`
  - Uses `launchMode="pi-session"` for takeover.
