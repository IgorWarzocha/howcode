# Pi Desktop Mock lane map

This repo is intentionally split around future Pi desktop integration seams.

## Renderer lanes

- `src/app/AppShell.tsx`
  - thin top-level composition only
  - hands off to `src/app/app-shell/AppShellLayout.tsx` and `src/app/app-shell/useAppShellController.ts`
- `src/app/app-shell/*`
  - renderer orchestration lane
  - shell bootstrap, live desktop-event sync, action post-processing, layout wiring
  - `useDesktopActionHandlers.ts` owns optimistic action dispatch and confirmation flow
  - `useProjectRepoOriginRefresh.ts` owns lazy repo-origin probing for the selected project
  - `useScopedProjectViewSync.ts` owns skills/extensions scoped-project reset behavior
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
  - main-panel view rendering for presentation-first surfaces like thread, landing, and settings
- `src/app/features/extensions/*`
  - extensions feature lane
  - package search, install/remove flows, and feature-local UI/controller ownership
- `src/app/features/skills/*`
  - skills feature lane
  - skill search, install/remove flows, and skill-creator ownership
- `src/app/ui/*`
  - shared Tailwind class primitives and utility helpers

## Desktop bridge lanes

- `src/bun/index.ts`
  - Electrobun `BrowserWindow` boot + Bun-side RPC handlers for the renderer
- `src/app/desktop/electrobun-api.ts`
  - renderer-side Electrobun bridge that preserves the `window.piDesktop` shape
- `shared/electrobun-rpc.ts`
  - typed Bun <-> webview RPC contract
- `desktop/pi-module.cts`
  - single dynamic-import boundary for the Pi package
- `desktop/project-git.cts`
  - selected-project git/branch/diff-stat probing used by header chrome
- `desktop/terminal/*`
  - PTY abstraction, Bun/node-pty adapter selection, transcript persistence, terminal event fanout
- `desktop/runtime/*`
  - Pi runtime lane: registry, composer state, attachments, thread publishing, session-path mapping
- `desktop/pi-threads/*`
  - shell loading, thread hydration, action routing, and payload parsing
  - `action-router.cts` is a thin dispatcher over `noop-actions.cts`, `project-actions.cts`, `thread-actions.cts`, `composer-actions.cts`, `workspace-actions.cts`, and `settings-actions.cts`
- `desktop/thread-state-db/*`
  - SQLite bootstrap/schema/query/write/mapping split
- `shared/pi-message-mapper.ts`
  - shared Pi session -> desktop message/title mapping ownership boundary
- `shared/pi-thread-action-payloads.ts`
  - shared desktop action payload parsing/validation helpers
- `shared/desktop-action-coverage.ts`
  - explicit implemented vs intentional no-op desktop action partition
- `shared/terminal-contracts.ts`
  - terminal session request/snapshot/event contract boundary

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
