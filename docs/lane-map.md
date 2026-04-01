# Pi Desktop Mock lane map

This repo is intentionally split around future Pi desktop integration seams.

## Renderer lanes

- `src/app/AppShell.tsx`
  - top-level composition only
  - binds reducer state, shell bridge, toast feedback
- `src/app/state/workspace.ts`
  - deterministic workspace reducer + selectors
  - safest place to grow mock state into persisted session state
- `src/app/data/mock-data.ts`
  - visual fixtures only
  - replace gradually with Pi SDK-backed data adapters
- `src/app/components/sidebar/*`
  - left rail and settings menu
- `src/app/components/workspace/*`
  - header, composer, diff, terminal shells
- `src/app/views/*`
  - main-panel view rendering by route/view mode
- `src/app/ui/*`
  - shared Tailwind class primitives and utility helpers

## Desktop bridge lanes

- `electron/contracts.cjs`
  - allowlisted action ids and shell defaults
- `electron/preload.cjs`
  - renderer-safe bridge exposure
- `electron/main.cjs`
  - BrowserWindow boot + IPC stub handlers

## Tooling lanes

- `biome.json`
  - formatting + lint rules
- `.husky/pre-commit`
  - staged-file hook entrypoint
- `package.json#lint-staged`
  - staged-file Biome checks
- `vite.config.ts`
  - React + Tailwind v4 plugin wiring

## Checks

- `npm run lint`
- `npm run format`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check`
