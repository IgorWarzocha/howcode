## Stack
- Use Bun for installs and scripts; keep the app runtime on Node.js/Electron.
- Biome for formatting, linting, and import organization.
- `tsgo --noEmit` via `@typescript/native-preview` for type checking.
- `bun run ai:check` is the repo-wide verification command.

## Code Quality
- MUST run `bun run ai:check` after concluding any changes.
- Run `bun run ai:check` frequently while working and always before considering the task complete.
- If you touch a subsystem with its own fast deterministic tests, run those too.
- Do not consider work complete while `ai:check` is failing.
- Never weaken strict Biome or TypeScript rules just to silence warnings quickly. Fix the issue properly or add a narrow, justified override.

## Project Workflow
- In dev, assume the app dev server is already running; do not start it manually, and use Electron CDP at `127.0.0.1:39217`.
- Pre-commit and pre-push hooks run verification automatically.
- Prefer `src/electron/main/**`, `src/electron/preload/**`, and `shared/*` contracts over ad-hoc desktop IPC shims.
- Keep UI changes optimistic and reuse existing patterns over one-offs.
- For major changes, validate with a commit and leave the repo committed.
- This repository uses nested AGENTS.md files to flag folder-specific guidelines. They are loaded automatically. No need to read them.
- Consider creating new, small AGENTS.md files whenever patterns are observed.
- AGENTS.md files are here to help you - if they are confusing, they should be edited to suit.
- Popovers, menus, and custom select dropdowns must close on Escape and when clicking outside, matching native control expectations. Escape handlers for nested popovers must run in capture phase and stop propagation so parent views/dialogs do not also close.
- Keep ASAR enabled; anything run by external stock Node must live outside ASAR with its full dependency tree, and launcher smoke tests must validate `app.asar` plus unpacked runtime deps.

## Server Mode Findings
- SSH remotes run in non-login shells; remote launch scripts must set `PATH`, `SHELL`, repo/runtime roots, and auth env explicitly instead of relying on user shell startup files.
- Remote server state belongs under `~/.howcode/ssh-launch/<state-key>/`; treat stale pid/port/fingerprint files as normal and restart managed servers when readiness, runner, or fingerprint checks fail.
- SSH activation should not require a saved local tunnel port. Let the SSH launcher allocate a dynamic loopback port and propagate the resulting `baseUrl`/environment back into connection state.
- Never log bearer tokens from SSH launch scripts, tunnel diagnostics, HTTP failures, or WebSocket/RPC URLs; redact before writing stderr or surfacing errors.
- New server-owned capabilities should use `shared/howcode-rpc.ts`/`HOWCODE_RPC_WS_PATH`; `HOWCODE_SERVER_REQUEST_PREFIX` and `shared/howcode-server-ws.ts` are legacy compatibility shims until RPC requests and streams fully replace them.
