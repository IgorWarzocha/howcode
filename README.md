> [!IMPORTANT]
> This is a one-man project. Only so many things I can check. Expect weird edge cases.

# Howcode

<img width="1920" height="1080" alt="Howcode screenshot" src="https://github.com/user-attachments/assets/c81d022e-75bd-4657-8d46-821514997d9c" />
<br />

Howcode is a desktop app for coding with Pi.

It is not trying to be a file editor. It is not trying to be VS Code with a chat panel glued on. The idea is simpler: keep the agent, terminal, project state, diffs, threads, and messy follow-up work in one place.

I built it because I clank a lot, and the existing apps kept making me babysit too many tabs, terminals, branches, and half-finished sessions. This one fits how I work. Maybe it fits how you work too.

## Install

```bash
npx howcode
# or
npm i -g howcode
howcode
```

The npm package is a launcher. It downloads the right desktop build from GitHub Releases, caches it, and relaunches the app.

The 0.1.68 release is the updater handoff release. Launching `bunx howcode` (or `bunx howcode@dev`)
once moves an older cached install onto the new updater. Older Windows installer installs may need
one manual reinstall; updates after that are staged and handed off automatically.

You can also download builds from the Releases page. Windows has an installer. Linux has an AppImage. macOS exists, but I build and test primarily on Linux, so please yell if it does something cursed.

Works on my machine™

## What it does

- **Pi sessions tied to projects** — start threads from projects, branches, worktrees, or chat.
- **Project sidebar** — projects, branches, worktrees, sessions, favorites, and recent activity.
- **Session tree** — navigate, label, and summarize parts of long agent threads with `/tree`.
- **Built-in terminal** — persisted transcript history, terminal drawer, and Pi TUI takeover mode when you want raw Pi.
- **Git/worktree flow** — create branches and worktrees, run sessions inside them, review diffs, and merge/remove completed work.
- **GitOps composer** — a separate composer for reviewing changed files and sending diff comments.
- **Inbox** — recent local session activity in one place.
- **Artifacts** — preview generated HTML/React-ish output without leaving the app.
- **Voice input** — local dictation through sherpa-ONNX, running on CPU.
- **Skills and extensions** — browse, install, remove, and configure Pi skills/extensions from inside the app.
- **Pi SDK extension UI** — dialogs, widgets, status lines, notifications, shortcuts, and project trust prompts.
- **Headless/browser mode** — run the app as a local server and use it from another browser on your LAN or Tailscale.

## What it deliberately is not

- A general-purpose code editor.
- A polished SaaS IDE.
- A safe multi-tenant server for strangers.
- A replacement for understanding what your agent is doing.

It is a cockpit for local/remote-ish agent work on a machine you trust.

## Headless / browser mode

Installed builds can run without opening the desktop window:

```bash
bunx howcode --headless
```

To access it from another device on your network:

```bash
bunx howcode --headless --host 0.0.0.0 --port 4173
```

Howcode prints an access URL with a token:

```text
http://<server-ip>:4173/#token=<printed-token>
```

For a stable token:

```bash
bunx howcode --headless --host 0.0.0.0 --port 4173 --token my-secret
# or
HOWCODE_HEADLESS_TOKEN=my-secret bunx howcode --headless --host 0.0.0.0 --port 4173
```

Notes:

- Default host is `127.0.0.1`.
- Use `--host 0.0.0.0` only on a trusted network, Tailscale, WireGuard, etc.
- Browser-picked, pasted, or dropped files are uploaded to a temp folder on the host before attaching.
- Host file browsing still browses the host filesystem.
- `openPath` and terminal actions happen on the host machine.
- This is not hardened SaaS auth. Treat it more like SSH with a UI.

## Run from source

```bash
bun install
bun run dev
```

Headless/browser dev mode skips the Electron window and serves the app through Vite:

```bash
bun run dev:headless
```

To try dev mode from another device on your network:

```bash
bun run dev:headless:host
# open http://<this-machine-ip>:5173/#token=<printed-token>
```

Repo-wide verification:

```bash
bun run ai:check
```

## Project status

This is moving fast and occasionally cuts itself.

The current shape is useful, but not all of it is equally finished. Some parts are sturdy. Some parts are “I needed this yesterday and now it exists”. If something feels wrong, file an issue. Screenshots help.

## Issues and updates

> [!IMPORTANT]
> I have bundled a skill for writing GH issues. Please use it with your Clanker.

- Bugs / requests: <https://github.com/IgorWarzocha/howcode/issues>
- Random updates: <https://x.com/Howaboua>
- This project uses Vouch.
