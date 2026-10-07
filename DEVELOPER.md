# Developer notes

Use Bun for installs and scripts. The browser app uses React and Vite. The server and backend run under stock Node 24.15 or newer, below Node 27. SQLite uses Node's built-in `node:sqlite` through Effect SQL.

## Local development

```bash
bun install
bun run dev
```

Open the URL printed by Vite. `bun run dev:host` binds to all interfaces for trusted-network access.

## Build and delivery

```bash
bun run build
bun start
bun run pack:howcode
```

The build produces `dist/`, `build/server/index.mjs`, the backend bundles in `build/desktop/`, and bundled skills in `build/resources/`. The npm package contains these outputs and installs ordinary runtime dependencies, including native terminal and dictation packages. There is no desktop installer or downloaded archive cache.

`Release artifacts` builds and uploads an npm tarball on branch pushes, version tags, and manual runs. Publishing npm packages remains explicit. `bun run publish:howcode:dry-run` checks the stable package without publishing. The dev package commands select the npm `dev` tag and a prerelease version.

To validate without overwriting a running app's build files:

```bash
HOWCODE_BUILD_ROOT=/tmp/howcode-check/build bun run build:runtime
bunx vite build --configLoader runner --outDir /tmp/howcode-check/dist
HOWCODE_BUILD_ROOT=/tmp/howcode-check/build HOWCODE_RENDERER_ROOT=/tmp/howcode-check/dist bun run pack:howcode
```

Do not clean live build outputs while an existing dev server is using them.

## Repo map

- `src/app/*` contains the browser app.
- `src/server/*` owns production HTTP transport and startup.
- `src/desktop-host/*` composes host operations and backend processes.
- `desktop/*` owns backend services.
- `shared/*` owns cross-runtime contracts.
- `packages/howcode/*` contains the npm entrypoint and package metadata.
- `scripts/*` owns development, build, and packaging.

## Checks and hooks

```bash
bun run ai:check
bun run check
```

The pre-commit hook runs lint-staged and `bun run ai:check`. The pre-push hook cleans build outputs and runs the same gate.
