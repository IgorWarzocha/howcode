# Dual Native Extension Implementation Checklist

Use this as the ordered checklist for adding a new Howcode-native dual-surface extension.

## Planning
1. Name extension id: `camelCase` for DB/session snapshot, e.g. `askQuestions`.
2. Name tool: model-facing snake_case, e.g. `ask_questions`.
3. Decide desktop pending state shape and answer/dismiss action.
4. Decide TUI interaction fallback inside the shared `.mjs` file.

## Shared extension
1. Create `desktop/native-extensions/<tool>.mjs`.
2. Import only dependencies that resolve from app/repo/package context.
3. Export default extension factory for Pi CLI/TUI.
4. Export named factory for desktop runtime-host injection.
5. Include prompt guidelines that encourage short sentences but do not enforce character limits.
6. Keep result formatting identical for desktop and TUI.

## Runtime path
1. Add or extend a `desktop/native-extensions/*-extension-path.cts` helper.
2. Return source path in dev and copied build path in packaged runtime.
3. Update `scripts/build-electron-runtime.ts` to copy the `.mjs` asset.
4. Update watch mode so copied `.mjs` assets refresh on edits; handle `fs.watch` events that omit `filename`.
5. Do not copy to user data unless bare dependency resolution is solved.

## Runtime-host desktop adapter
1. Add `desktop/runtime-host/<tool>-tool.cts`.
2. Dynamically import shared `.mjs` with `pathToFileURL(extensionPath).href`.
3. Pass `defineTool` into the named factory.
4. Pass desktop callbacks that create/resolve worker-safe pending state.
5. Publish composer state when pending state changes.

## Session snapshot
1. Add global setting if needed.
2. Add session snapshot reads/writes in main-safe DB code.
3. Add runtime-host main requests if worker code needs snapshot/defaults.
4. For persisted sessions, read snapshot first.
5. If the snapshot row is missing (`null`), fallback to current defaults and persist that snapshot for legacy/first-materialized sessions.
6. If the snapshot row exists but is empty (`[]`), treat native extensions as explicitly disabled for that session.
7. For new sessions, snapshot global defaults once and store them.

## Composer UI
1. Add `ComposerState` field for pending request.
2. Render UI above composer using overlay pattern.
3. Route submit/dismiss to a specific desktop action.
4. Add the action to contracts, canonical action list, payload readers, router, and action coverage registry.
5. Include composer context (`composerMode`, `chatGroupId`, session path/project id as needed) on answer/dismiss payloads.
6. Ensure normal user prompts do not send while pending.
7. Preserve text editing in the composer while pending; ArrowLeft/ArrowRight should move the caret unless it is already at the boundary where question navigation makes sense.
8. Do not optimistically hide the only pending UI before answer/dismiss IPC succeeds.
9. Reset local pending-card state when a new request arrives.
10. Support empty/other/freeform behavior as product requires, including clearing stale custom answers.
11. Prefer explicit Dismiss/Escape over outside-click dismissal when clicking/focusing the composer is part of answering the pending tool.

## TUI takeover
1. In `desktop/terminal/terminal-command.helpers.ts`, read session snapshot.
2. For each enabled native extension, append `--extension <same shared .mjs path>`.
3. Verify launch args are built from persisted session path.

## Final validation
1. Confirm no duplicate tool implementation exists.
2. Confirm worker-reachable files do not import DB/native modules.
3. Confirm runtime mutations that suspend disposal re-schedule disposal in `finally`.
4. Confirm pending requests settle on replacement, abort, answer, and dismiss.
5. Commit and let hooks run.
6. Report exact paths changed and which surfaces were validated.
