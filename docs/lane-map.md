# Pi Desktop Mock lane map

This repo is intentionally split around future Pi desktop integration seams.

## Renderer lanes

- `src/app/AppShell.tsx`
  - thin top-level composition only
  - hands off to `src/app/app-shell/AppShellLayout.tsx` and `src/app/app-shell/useAppShellController.ts`
- `src/app/app-shell/*`
  - renderer orchestration lane
  - shell bootstrap, live desktop-event sync, action post-processing, layout wiring
- `src/app/state/workspace.ts`
  - deterministic workspace reducer + selectors
  - safest place to grow mock state into persisted session state
- `src/app/data/mock-data.ts`
  - visual fixtures only
  - replace gradually with Pi SDK-backed data adapters
- `src/app/components/sidebar/*`
  - left rail and settings menu
  - `project-tree/*` holds project/thread row decomposition and dismiss helpers
- `src/app/components/workspace/*`
  - header, composer, diff, terminal shells
  - `workspace/composer/*` holds banner, menus, attachments, and controller logic
- `src/app/views/*`
  - main-panel view rendering by route/view mode
- `src/app/ui/*`
  - shared Tailwind class primitives and utility helpers

## Desktop bridge lanes

- `electron/main.cts`
  - BrowserWindow boot + IPC registration
- `electron/preload.cts`
  - renderer-safe bridge exposure
- `electron/contracts.cts`
  - IPC channel contracts and shell defaults
- `electron/pi-module.cts`
  - single dynamic-import boundary for the Pi package
- `electron/project-git.cts`
  - selected-project git/branch/diff-stat probing used by header chrome
- `electron/runtime/*`
  - Pi runtime lane: registry, composer state, attachments, thread publishing, session-path mapping
- `electron/pi-threads/*`
  - shell loading, thread hydration, action routing, and payload parsing
- `electron/thread-state-db/*`
  - SQLite bootstrap/schema/query/write/mapping split
- `shared/pi-message-mapper.ts`
  - shared Pi session -> desktop message/title mapping ownership boundary
- `shared/pi-thread-action-payloads.ts`
  - shared desktop action payload parsing/validation helpers
- `shared/desktop-action-coverage.ts`
  - explicit implemented vs intentional no-op desktop action partition

## Tooling lanes

- `biome.json`
  - formatting + lint rules
- `.husky/pre-commit`
  - staged-file hook entrypoint
- `package.json#lint-staged`
  - staged-file Biome checks
- `vite.config.ts`
  - React + Tailwind v4 plugin wiring

## Deterministic test lanes

- `src/app/state/workspace.test.ts`
  - workspace reducer/selector coverage
- `src/test/pi-message-mapper.test.ts`
  - shared Pi message/title mapping coverage
- `src/test/pi-thread-action-payloads.test.ts`
  - action payload parsing coverage
- `src/test/desktop-action-coverage.test.ts`
  - action contract coverage partition

## Checks

- `bun run lint`
- `bun run format`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run check`
