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

## Current status

Howcode is early, but already useful.

Today the app includes real:

- Pi composer send + streaming
- project and thread persistence
- PTY-backed terminal support
- checkpoint-backed diff rendering
- partial git/project actions

Still in progress:

- git-ops UX
- diff review flow
- some header/navigation actions
- remote/collaboration-oriented surfaces

## Docs

- `DEVELOPER.md` — local setup, architecture, release flow, packaging
- `CHANGELOG.md` — release history and short-term roadmap
- `docs/roadmap.md` — broader product direction
- `docs/mock-features.md` — current real vs mock inventory

## Issues

- Bugs / requests: https://github.com/IgorWarzocha/howcode/issues
