# Pi Desktop Mock

Codex-inspired desktop shell for Pi, focused on UI/UX first.

## Current scope

- Electron desktop shell
- React/Vite renderer
- Tailwind CSS v4 styling
- modular UI shell with typed desktop action contracts and explicit mock/no-op coverage
- split Electron runtime / thread / SQLite lanes
- deterministic workspace + shared helper unit tests
- Biome for linting and formatting
- Husky + lint-staged pre-commit scaffolding

## Run

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run format
npm run typecheck
npm run test
npm run build
npm run check
```

## Pre-commit hooks

This repo includes a `.husky/pre-commit` hook that runs `lint-staged`, which in turn runs Biome on staged files.

If this directory is turned into a git repo later, run:

```bash
git init
npm install
```

The `prepare` script will then activate Husky automatically.

## File map

- `src/app/AppShell.tsx` — top-level renderer composition
- `src/app/app-shell/*` — shell controller + layout orchestration
- `src/app/components/` — reusable UI pieces
- `src/app/components/workspace/composer/*` — composer subcomponents/controller
- `src/app/components/sidebar/project-tree/*` — project tree subcomponents/controller
- `src/app/views/` — main content modes
- `src/app/state/` — reducer/selectors and tests
- `src/app/data/` — mock fixtures
- `src/app/ui/` — shared Tailwind class primitives
- `electron/runtime/*` — Pi runtime registry/composer/attachment/publisher lanes
- `electron/pi-threads/*` — shell loading, thread hydration, action routing
- `electron/project-git.cts` — selected-project git/branch/diff-stat probing for header chrome
- `electron/thread-state-db/*` — SQLite schema/query/write/mapping lanes
- `shared/` — shared contracts, mapping helpers, action coverage metadata
- `docs/lane-map.md` — concise ownership map
- `docs/mock-features.md` — current real vs mock inventory
- `docs/implementation-todo.md` — prioritized execution backlog

## Next integration step

Finish the remaining mock desktop controls (`project.actions`, header action menus, host/profile/dictate, terminal/diff backing data) while keeping the new lane boundaries intact.
