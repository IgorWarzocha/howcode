# Developer notes

## Stack

- Bun for installs/scripts
- Node.js 24 LTS runtime target
- Electron
- React + Vite
- Tailwind CSS v4
- SQLite via `better-sqlite3`

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

The `Release artifacts` GitHub workflow is authoritative. Pushes to `main` and `dev` build all six
OS/architecture targets and safely refresh `channel-main` or `channel-dev`; version tags publish an
immutable release. Local preparation builds only the current host and is useful for diagnosis:

```bash
bun run release:prepare
```

This produces:

- `artifacts/electron/` — Electron unpacked release artifacts
- `artifacts/electron/*.AppImage` — Linux AppImage artifacts on Linux builds
- `artifacts/npm-launcher/` — launcher archives consumed by the npm package

Each target contributes:

- `stable-<os>-<arch>-update.json`
- `archive-howcode-<os>-<arch>-<sha256>.tar.gz` — immutable updater payload
- `howcode-<os>-<arch>.tar.gz` — legacy launcher fallback
- platform installer/AppImage/zip artifacts

The workflow validates all six manifests and hashes before publishing payloads, then swaps manifests
last. Do not manually replace a channel manifest before its referenced archive exists.

When publishing a launcher with a new startup-readiness protocol, refresh channel desktop artifacts
first and publish npm second. Existing launchers can start the new app; the reverse order makes the
new launcher wait on an older app that cannot acknowledge readiness.

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
bun run ai:check
bun run check
```

Hooks:

- `.husky/pre-commit` — lint-staged, then `bun run ai:check`
- `.husky/pre-push` — clean build outputs, then `bun run ai:check`
