## Stack
- Use Bun for installs and scripts; keep the app runtime on Node.js/Electron.
- `bun run ai:check` is the repo-wide verification command; do not run standalone formatting or typechecking commands.

## Code Quality
- Run `bun run ai:check` after meaningful code, config, packaging, or behavior changes.
- Do not run `bun run ai:check` for docs-only or AGENTS.md-only edits unless they change commands, configuration, packaging, workflow behavior, or explicit validation instructions.
- Run `bun run ai:check` frequently while working on code and before considering substantive implementation work complete.
- If you touch a subsystem with its own fast deterministic tests, run those too.
- Do not consider substantive implementation work complete while `ai:check` is failing.
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
