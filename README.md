# howcode

Codex-inspired desktop shell for Pi, focused on making local coding workflows feel fast, native, and eventually collaborative.

## Current scope

- Electrobun desktop shell
- React/Vite renderer
- Tailwind CSS v4 styling
- modular UI shell with typed desktop action contracts and explicit mock/no-op coverage
- split desktop runtime / thread / SQLite lanes
- Bun-native main process with Electrobun RPC bridge into the renderer
- real xterm.js terminal panel backed by Bun PTY first, with `node-pty` kept only as the Windows compatibility fallback
- Pi takeover terminal view that replaces the thread pane with an embedded native Pi TUI lane
- composer surface split into prompt and git-ops modes so we can iterate on each state independently while the git lane is still partial
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

## Product status snapshot

This repo is no longer "all mock," but it is still intentionally mixed:

- **real enough today:** composer send/streaming, thread hydration, project/thread persistence, terminal PTY integration, checkpoint-backed diff rendering, git probing, project actions like rename/archive/remove/open-in-file-manager
- **still partial:** git-ops UX, terminal polish, diff review flow, some settings/navigation/header affordances
- **still mocked or placeholder-only:** remote connections, dictate control, plugins/automations/debug surfaces, several header actions/trace IDs, project worktree creation

The canonical status docs live here:

- `docs/mock-features.md` — current real vs mock inventory
- `docs/implementation-todo.md` — legacy execution backlog
- `docs/roadmap.md` — product roadmap and major epics
- `docs/todolist.md` — grouped work buckets we can pick up next

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

This repo includes:

- `.husky/pre-commit` — runs `lint-staged`, `bun run typecheck`, and `bun run test`
- `.husky/pre-push` — runs `bun run check`

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
- `src/app/views/` — main content modes that are still pure views (`LandingView`, `ThreadView`, `SettingsView`)
- `src/app/features/extensions/*` — extension catalog/install feature boundary
- `src/app/features/skills/*` — skill catalog/install/create feature boundary
- `src/app/query/*` — React Query client + desktop query helpers
- `src/app/state/` — reducer/selectors and tests
- `src/app/data/` — mock fixtures
- `src/app/ui/` — shared Tailwind class primitives
- `src/bun/index.ts` — Electrobun main-process entry and RPC request handlers
- `desktop/runtime/*` — Pi runtime registry/composer/attachment/publisher lanes
- `desktop/pi-threads/*` — shell loading, thread hydration, action routing
- `desktop/project-git/*` — selected-project git/branch/diff/commit helpers
- `desktop/terminal/*` — PTY adapters and terminal session manager
- `desktop/thread-state-db/*` — SQLite schema/query/write/mapping lanes
- `shared/` — shared contracts, mapping helpers, action coverage metadata
- `docs/lane-map.md` — concise ownership map
- `docs/mock-features.md` — current real vs mock inventory
- `docs/implementation-todo.md` — prioritized execution backlog
- `docs/roadmap.md` — phased roadmap and product bets
- `docs/todolist.md` — grouped execution checklist

## Current roadmap focus

Near-term work is concentrated in three buckets:

1. **easy wins / cleanup** — status-marker drift, sidebar polish, remaining small mock controls
2. **interconnected implementation batches** — header/navigation actions, git+diff+review convergence, terminal+host+remote execution convergence
3. **longer-term epics** — OpenClaw-style workflows, Just Chat mode, Cowork/collaboration flows, and an extension that tightly integrates Pi with the app

See `docs/roadmap.md` and `docs/todolist.md` for the actual plan.

## Routing note for later

- Defer router adoption until `/home/igorw/Work/howcode` has clearly navigable state worth encoding as route/search params.
- Strong triggers for later adoption would be deep-linkable thread selection, diff turn/file selection, archived/settings panels, and real back/forward semantics.
- Until then, reducer-driven shell state is intentionally simpler than introducing a route model too early.
