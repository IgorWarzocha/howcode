# Developer notes

## Stack

- Node.js 24 LTS
- Electron
- React + Vite
- Tailwind CSS v4
- SQLite via `better-sqlite3`

## Local development

```bash
npm install
npm run dev
```

## Common commands

```bash
npm run build
npm run build:release
npm run build:launcher-artifacts
npm run release:prepare
npm run publish:howcode:dry-run
```

## Release flow

Build release artifacts:

```bash
npm run release:prepare
```

This produces:

- `artifacts/electron/` — Electron unpacked release artifacts
- `artifacts/npm-launcher/` — launcher archives consumed by the npm package

For a GitHub release, upload both:

- `stable-<os>-<arch>-update.json`
- Electron unpacked bundle artifacts
- `howcode-<os>-<arch>.tar.gz`

Launcher base URL:

- `https://github.com/IgorWarzocha/howcode/releases/latest/download`

GitHub workflow:

- push a tag like `v0.1.0` to build all release artifacts and publish a GitHub release automatically

## NPM launcher package

The user-facing npm package lives in:

- `packages/howcode`

It is a thin launcher that:

1. resolves the latest GitHub release metadata
2. downloads the matching platform archive on first run
3. caches it locally
4. launches the packaged desktop app

Desktop release builds bundle Electron with Chromium on macOS, Linux, and Windows.

## Repo map

- `src/app/*` — renderer app
- `src/electron/*` — Electron main and preload layers
- `desktop/*` — desktop runtime lanes
- `shared/*` — shared contracts and helpers
- `packages/howcode/*` — npm launcher package
- `scripts/*` — build and packaging scripts

## Checks and hooks

Main checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run check
```

Hooks:

- `.husky/pre-commit` — lint-staged, typecheck, test
- `.husky/pre-push` — full `npm run check`

## Useful docs

- `docs/roadmap.md`
- `docs/todolist.md`
- `docs/mock-features.md`
- `docs/implementation-todo.md`
- `docs/lane-map.md`

