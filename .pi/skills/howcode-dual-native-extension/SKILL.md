---
name: howcode-dual-native-extension
description: Build or modify Howcode native extensions that work in both desktop composer/runtime-host and Pi TUI takeover. Use when adding another Howcode-only agent tool, dual-surface extension, native extension setting, per-session extension snapshot, or composer-adjacent tool UI. Do not use for ordinary installable Pi extensions or UI-only composer cards.
---

# Howcode Dual Native Extension

## Purpose
Use this skill to add a Howcode-only agent tool that has one shared extension definition but adapts to two execution surfaces: Howcode desktop runtime-host and embedded Pi TUI takeover.

The core invariant: **one extension file owns the tool schema, prompt text, validation, result formatting, and TUI behavior**. Desktop may provide an adapter for composer UI, but must not fork the tool into a second implementation.

## When to use
- User asks for “another native extension”, “like ask questions”, “dual nature extension”, or “works in desktop and pi-tui”.
- A new agent-callable tool needs Howcode desktop UI and Pi TUI behavior.
- A feature needs global setting defaults but must snapshot enabled tools per session.
- A composer-adjacent card must answer a pending tool call instead of sending a normal user prompt.

## Do not use when
- The extension is meant to be npm/package installable for regular Pi users.
- The work is only a visual composer card with no agent tool.
- The work is only an ordinary Pi extension installed through settings.
- The change can be done as a normal built-in Pi tool with no Howcode session/state integration.

## Critical rules
1. **One shared extension file.** Put shared tool behavior in `desktop/native-extensions/<name>.mjs`.
2. **Desktop adapts, it does not duplicate.** Runtime-host imports the shared file and injects desktop-specific callbacks.
3. **TUI takeover uses the same file.** The terminal launch path passes `--extension <same file>` when the session snapshot enables it.
4. **Snapshot per session.** The active native extension set is read from `session_native_extensions`; new sessions snapshot global defaults once.
5. **Do not import DB/native modules into runtime-host worker code.** Runtime-host must use `invokeMainRequest` for DB-backed data.
6. **No prompt character limits.** Prompt the extension toward short sentences/options, but do not enforce brittle character counts.
7. **Composer interception must be explicit.** While a pending tool UI is active, Enter/Escape/submit must answer/dismiss the tool instead of sending normal user text.

## Reference files
Read these before implementing a new dual native extension:

- `references/file-map.md` — exact reference files and ownership boundaries.
- `references/implementation-checklist.md` — ordered build checklist.

## Workflow

### 1. Define the extension contract
- Pick a stable internal extension id, e.g. `askQuestions`.
- Pick a tool name for the model, e.g. `ask_questions`.
- Define shared input/output types in `shared/desktop-composer-contracts.ts` or a nearby shared contract file if desktop UI needs them.
- Add desktop action payload/result contracts if the user can answer/resolve pending tool state from the renderer.

### 2. Create or update the shared extension file
- Add `desktop/native-extensions/<extension-name>.mjs`.
- Export:
  - a default Pi extension factory for TUI takeover: `export default function extension(pi) { pi.registerTool(...) }`
  - a named factory for desktop adaptation, e.g. `createHowcodeXTool({ defineTool, ...callbacks })`
- Keep schema, promptSnippet, promptGuidelines, input normalization, result formatting, and TUI UI in this file.
- If desktop needs different UI, pass a callback such as `askInComposer(...)` into the named factory.

### 3. Add runtime path resolution
- Use or extend `desktop/native-extensions/ask-questions-extension-path.cts` style helpers.
- In dev, return the source-side extension path so bare deps resolve from the repo.
- In packaged builds, ensure the build script copies the `.mjs` file beside the desktop bundle and resolution finds it.
- Do not copy extension files into user data if they import bare packages unless module resolution is also solved.

### 4. Wire desktop runtime-host
- In `desktop/runtime-host/live-runtime-registry.cts`, read enabled native extensions through runtime-host → main IPC.
- If enabled, dynamically import the shared `.mjs` file from the runtime path.
- Create the tool using the named factory and pass desktop callbacks that publish/update composer state.
- Store pending request state in worker-safe modules only; avoid `better-sqlite3` or Electron imports in worker-reachable files.

### 5. Wire main-process persistence
- Add/extend DB schema in `desktop/thread-state-db/schema.cts` only from main-safe code.
- Use `desktop/thread-state-db/queries.cts` and `desktop/thread-state-db/session-writes.cts` for session snapshot reads/writes.
- Expose runtime-host main requests in `desktop/runtime-host/protocol.cts` and `desktop/runtime-host/client-bridge.cts` when worker code needs DB-backed data.

### 6. Wire settings and session snapshot
- Add global setting contract/key/reader/writer.
- Add settings UI toggle in the settings descriptor flow.
- Add optimistic update handling.
- Snapshot global defaults into `session_native_extensions` when a session is created or first materialized.
- Never let toggling the global setting mutate an existing session’s enabled toolkit.

### 7. Wire desktop UI
- Surface pending tool state in `ComposerState`.
- Render composer-adjacent UI above the composer using existing overlay/measurement patterns.
- Add a specific action such as `composer.answer-native-questions` to resolve the pending tool promise.
- Ensure normal composer submission is overridden while pending.

### 8. Wire Pi TUI takeover
- In `desktop/terminal/terminal-command.helpers.ts`, when `launchMode === "pi-session"`:
  - resolve persisted session path
  - read `getSessionNativeExtensions(persistedSessionPath)`
  - append `--extension <same shared extension path>` for enabled native extensions
- Keep this path hidden/integrated; do not expose ordinary user package installation for Howcode-native extensions.

### 9. Build and validate
- Let git hooks run on commit; do not bypass them.
- For this repo, do not manually run typechecks/tests unless explicitly asked. If committing, hooks will run configured checks.
- Validate by inspecting the exact launch args and desktop runtime registration path.
- If the dev app is running, test both surfaces:
  - desktop: model/tool call creates composer-adjacent pending UI
  - takeover: `pi --session ... --extension ...` loads same tool and uses TUI UI

## Validation checklist
- [ ] One `.mjs` extension file owns shared tool schema/prompt/result/TUI behavior.
- [ ] Desktop runtime imports that same `.mjs` file and only injects callbacks.
- [ ] TUI takeover passes that same `.mjs` file via `--extension`.
- [ ] Per-session snapshot controls availability for both surfaces.
- [ ] Existing sessions keep their snapshot after global setting changes.
- [ ] Worker code does not import DB/native modules.
- [ ] Composer submit is intercepted while pending.
- [ ] Build script copies native extension assets for packaged builds.
- [ ] Commit hooks pass.

## Error handling
### Error: TUI or runtime-host cannot resolve package imports from extension
Cause: extension was copied to a location outside repo/app module resolution.
Action: load the bundled/source-side extension path directly, or bundle dependencies with the extension. Do not copy to user data unless dependency resolution is handled.

### Error: `better-sqlite3.node` ABI/native module failure in worker
Cause: runtime-host imported DB-backed main modules.
Action: move DB access behind runtime-host main request IPC via `desktop/runtime-host/protocol.cts` and `client-bridge.cts`.

### Error: global toggle changes an existing session’s tools
Cause: runtime reads global setting directly instead of session snapshot.
Action: fix the runtime to read `session_native_extensions` for persisted sessions and only snapshot defaults for new sessions.

### Error: desktop and TUI behavior drift
Cause: two separate tool implementations exist.
Action: move schema/prompt/result/TUI logic back into the shared `.mjs` file and keep desktop-specific code as injected callbacks.

## Output contract
When completing a dual native extension task, report:
- shared extension file path
- desktop adapter files changed
- TUI takeover launch wiring changed
- setting/session snapshot files changed
- validation performed or hooks that passed
- any remaining surface not yet tested

## Examples
### Example 1
User says: “Add a native tool like ask questions, but for picking files, and make it work in TUI too.”
Expected behaviour:
1. Create one shared `.mjs` extension for the tool.
2. Add desktop callback adapter for composer/file-picker UI.
3. Add per-session setting snapshot.
4. Add `--extension` launch wiring for takeover.

### Example 2
User says: “This native extension works in desktop but not pi-tui.”
Expected behaviour:
1. Inspect `desktop/terminal/terminal-command.helpers.ts` launch args.
2. Verify session snapshot includes the extension id.
3. Verify the same shared `.mjs` file is passed via `--extension`.
4. Fix module resolution if Pi cannot import dependencies.
