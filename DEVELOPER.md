# Developer notes

## Stack

- Bun
- Electrobun
- React + Vite
- Tailwind CSS v4
- SQLite via `bun:sqlite`

## Local development

```bash
bun install
bun run dev
```

## Common commands

```bash
bun run build
bun run build:release
bun run build:launcher-artifacts
bun run release:prepare
bun run publish:howcode:dry-run
```

## Release flow

Build release artifacts:

```bash
bun run release:prepare
```

This produces:

- `artifacts/` — Electrobun release artifacts
- `artifacts/npm-launcher/` — launcher archives consumed by the npm package

For a GitHub release, upload both:

- `stable-<os>-<arch>-update.json`
- `stable-<os>-<arch>-*` Electrobun artifacts
- `howcode-<os>-<arch>.tar.gz`

Launcher base URL:

- `https://github.com/IgorWarzocha/howcode/releases/latest/download`

## NPM launcher package

The user-facing npm package lives in:

- `packages/howcode`

It is a thin launcher that:

1. resolves the latest GitHub release metadata
2. downloads the matching platform archive on first run
3. caches it locally
4. launches the packaged desktop app

## Repo map

- `src/app/*` — renderer app
- `src/bun/*` — Electrobun main process
- `desktop/*` — desktop runtime lanes
- `shared/*` — shared contracts and helpers
- `packages/howcode/*` — npm launcher package
- `scripts/*` — build and packaging scripts

## Checks and hooks

Main checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run check
```

Hooks:

- `.husky/pre-commit` — lint-staged, typecheck, test
- `.husky/pre-push` — full `bun run check`

## Useful docs

- `docs/roadmap.md`
- `docs/todolist.md`
- `docs/mock-features.md`
- `docs/implementation-todo.md`
- `docs/lane-map.md`

