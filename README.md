# Pi Desktop Mock

Codex-inspired desktop shell for Pi, focused on UI/UX first.

## Current scope

- Electrobun desktop shell
- React/Vite renderer
- Tailwind CSS v4 styling
- modular UI shell with typed desktop action contracts and explicit mock/no-op coverage
- split desktop runtime / thread / SQLite lanes
- Bun-native main process with Electrobun RPC bridge into the renderer
- real xterm.js terminal panel backed by Bun PTY first, with `node-pty` kept only as the Windows compatibility fallback
- Pi takeover terminal view that replaces the thread pane with an embedded native Pi TUI lane
- composer surface split into prompt and mock git-ops modes so we can iterate on each state independently
- centered thread scroller with natural-flow row rendering, reliable folding, bottom-stick behavior during live updates, and preserved in-lane scrolling
- selected-session Pi JSONL watching so the open thread refreshes when the same session changes externally in Pi TUI
- visible assistant reasoning blocks that auto-expand while streaming and collapse when the turn settles
- grouped, folded-by-default tool-call cards in the thread timeline, with per-tool expand/collapse controls
- real checkpoint-backed diff panel using `@pierre/diffs`, with whole-thread and per-turn patch rendering for completed composer turns in git repos
- React Query-backed desktop data loading with React Pacer used to debounce shell refresh churn after desktop event bursts
- dnd-kit-backed project drag-and-drop with persisted sidebar project ordering
- deterministic workspace + shared helper unit tests
- Biome for linting and formatting
- Husky + lint-staged pre-commit scaffolding

## Run

```bash
bun install
bun run dev
```

## Checks

```bash
bun run lint
bun run format
bun run typecheck
bun run test
bun run build
bun run check
```

## Pre-commit hooks

This repo includes a `.husky/pre-commit` hook that runs `lint-staged`, which in turn runs Biome on staged files.

If this directory is turned into a git repo later, run:

```bash
git init
bun install
```

The `prepare` script will then activate Husky automatically.

## File map

- `src/app/AppShell.tsx` — top-level renderer composition
- `src/app/app-shell/*` — shell controller + layout orchestration
- `src/app/components/` — reusable UI pieces
- `src/app/components/workspace/composer/*` — composer subcomponents/controller
- `src/app/components/sidebar/project-tree/*` — project tree subcomponents/controller
- `src/app/views/` — main content modes
- `src/app/query/*` — React Query client + desktop query helpers
- `src/app/state/` — reducer/selectors and tests
- `src/app/data/` — mock fixtures
- `src/app/ui/` — shared Tailwind class primitives
- `src/bun/index.ts` — Electrobun main-process entry and RPC request handlers
- `desktop/runtime/*` — Pi runtime registry/composer/attachment/publisher lanes
- `desktop/pi-threads/*` — shell loading, thread hydration, action routing
- `desktop/project-git.cts` — selected-project git/branch/diff-stat probing for header chrome
- `desktop/terminal/*` — PTY adapters and terminal session manager
- `desktop/thread-state-db/*` — SQLite schema/query/write/mapping lanes
- `shared/` — shared contracts, mapping helpers, action coverage metadata
- `docs/lane-map.md` — concise ownership map
- `docs/mock-features.md` — current real vs mock inventory
- `docs/implementation-todo.md` — prioritized execution backlog

## Next integration step

Finish the remaining mock desktop controls (`project.actions`, header action menus, host/profile/dictate, composer-adjacent git ops, terminal multi-session polish) while keeping the new lane boundaries intact.

## Routing note for later

- Defer router adoption until `/home/igorw/Work/howcode` has clearly navigable state worth encoding as route/search params.
- Strong triggers for later adoption would be deep-linkable thread selection, diff turn/file selection, archived/settings panels, and real back/forward semantics.
- Until then, reducer-driven shell state is intentionally simpler than introducing a route model too early.
