# Pi Desktop Mock

Codex-inspired desktop shell for Pi, focused on UI/UX first.

## Current scope

- Electron desktop shell
- React/Vite renderer
- Tailwind CSS v4 styling
- modular UI shell with typed desktop action stubs
- deterministic workspace reducer + unit tests
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
- `src/app/components/` — reusable UI pieces
- `src/app/views/` — main content modes
- `src/app/state/` — reducer/selectors and tests
- `src/app/data/` — mock fixtures
- `src/app/ui/` — shared Tailwind class primitives
- `electron/` — shell bootstrap and typed IPC stub boundary
- `docs/lane-map.md` — concise ownership map

## Next integration step

Replace mock renderer data with a Pi SDK session adapter built around `createAgentSession()` from `@mariozechner/pi-coding-agent`.
