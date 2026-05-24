## Stack
- Use Bun for installs and scripts; keep the app runtime on Node.js/Electron.
- `bun run ai:check` is the repo-wide verification command; pre-commit/pre-push hooks run it automatically.

## Code Quality
- Prefer committing to validate completed work; do not run standalone formatting/typechecking commands.
- Run `bun run ai:check` manually only when asked, when not committing, or when debugging a failing hook.
- If you touch a subsystem with its own fast deterministic tests, run those when useful.
- Never weaken strict Biome or TypeScript rules just to silence warnings quickly. Fix the issue properly or add a narrow, justified override.
- Prefer modular structure before piling more branches into an existing file. When a change adds a new concern, platform split, state machine, or UI surface, first consider a small folder/module boundary instead of growing a godfile/godfunction.

## Project Workflow
- In dev, assume the app dev server is already running; do not start it manually, and use Electron CDP at `127.0.0.1:39217`.
- Prefer `src/electron/main/**`, `src/electron/preload/**`, and `shared/*` contracts over ad-hoc desktop IPC shims.
- Keep UI changes optimistic and reuse existing patterns over one-offs.
- For UI styling, check `src/app/ui/classes.ts` and established primitives first; reuse app typography/style roles, no inline one-off styling.
- For major changes, validate with a commit and leave the repo committed.
- This repository uses nested AGENTS.md files to flag folder-specific guidelines. They are loaded automatically. No need to read them.
- Consider creating new, small AGENTS.md files whenever patterns are observed.
- AGENTS.md files are here to help you - if they are confusing, edit them.
- Popovers, menus, and custom select dropdowns must close on Escape and when clicking outside, matching native control expectations. Escape handlers for nested popovers must run in capture phase and stop propagation so parent views/dialogs do not also close.
- Keep ASAR enabled; anything run by external stock Node must live outside ASAR with its full dependency tree, and launcher smoke tests must validate `app.asar` plus unpacked runtime deps.
