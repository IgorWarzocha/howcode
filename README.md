>[!IMPORTANT] 
>If you somehow ended up here before I said I am ready, do yourself a favour and use the dev version via `bun run dev`. Things are changing rapidly. Releases will be built only when I feel like a milestone is feature-ready and without any experience-breaking bugs. Current initial release was mostly to see if it builds and if I can use the app to build itself. I kinda can.

# howcode

Howcode is a desktop shell for Pi that makes local coding workflows feel fast, native, and focused.

It combines:

- threaded Pi conversations
- project-aware sidebars and inbox flows
- a built-in terminal
- diff views for coding work
- local-first desktop behavior

## Install

```bash
npx howcode
# or
npm i -g howcode
howcode
```

On first run, the launcher downloads the matching desktop build for your platform and caches it locally.

### Renderer note

Release builds now ship with bundled Electron + Chromium on macOS, Linux, and Windows.

The tradeoff is larger downloads in exchange for a more consistent renderer.

## Current status

Howcode is early, but already useful.

Today the app includes real:

- Pi composer send + streaming
- project and thread persistence
- PTY-backed terminal support
- checkpoint-backed diff rendering
- project actions and partial git/commit actions
- project-aware sidebar and inbox flows
- skills/extensions browse and install surfaces

## Docs

- `DEVELOPER.md` — local setup, architecture, release flow, packaging
- `CHANGELOG.md` — release history and short-term roadmap
- `docs/roadmap.md` — broader product direction
- `docs/mock-features.md` — current real vs mock inventory

## Issues

- Bugs / requests: https://github.com/IgorWarzocha/howcode/issues
