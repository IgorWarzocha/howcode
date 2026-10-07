> [!IMPORTANT]
> This is a one-man project. Only so many things I can check. Expect weird edge cases.

# Howcode

<img width="1920" height="1080" alt="Howcode screenshot" src="https://github.com/user-attachments/assets/c81d022e-75bd-4657-8d46-821514997d9c" />
<br />

Howcode is a browser app for coding with Pi. A local Node server runs the agent, terminal, and project workflows.

It is not trying to be a file editor. It is not trying to be VS Code with a chat panel glued on. The idea is simpler: keep the agent, terminal, project state, diffs, threads, and messy follow-up work in one place.

I built it because I clank a lot, and the existing apps kept making me babysit too many tabs, terminals, branches, and half-finished sessions. This one fits how I work. Maybe it fits how you work too.

## Install

```bash
npx howcode
# or
npm i -g howcode
howcode
```

Requires Node 24.15 or newer, below Node 27. Open the access URL printed by Howcode in your browser. Keep the server running while you work.

The npm package contains the server and browser app. Native terminal and dictation dependencies install for your machine through npm. Updating Howcode means installing a newer npm package, not an in-app updater.

Works on my machine™

## Packages

Install Durable extensions from a local directory, Git, or npm. No published release is required for local or Git packages.

```bash
howcode install ./my-tools
howcode install git:github.com/example/my-tools@v1
howcode install npm:@example/my-tools@1.0.0
howcode list
howcode update
howcode remove ./my-tools
```

Git and npm installs require Bun on `PATH`. Install only trusted packages. Installation scripts and extensions run with your user permissions. Local sources stay in place and are not built or modified by Howcode.

Restart Howcode after package changes. Installed extensions are selected for new conversations. Existing conversations keep their explicit selections. Use `--data-path <directory>` with both Howcode and its package commands when using a separate profile.

Packages export ordinary Durable extension objects from their package entry point or Pi's `pi.extensions` paths. Normal Pi coding-agent extensions use a different API and are not compatible. Howcode checks declared `@earendil-works/pi-durable` peer requirements before loading. The Durable notebook package's host setup is handled automatically.

## What it does

- **Durable conversations**: start threads from projects, branches, worktrees, or chat.
- **Project sidebar** — projects, branches, worktrees, sessions, favorites, and recent activity.
- **Conversation forks**: continue from an earlier message with `/fork` without changing the original conversation.
- **Built-in terminal** — a shell terminal drawer with persisted transcript history.
- **Git/worktree flow** — create branches and worktrees, run sessions inside them, review diffs, and merge/remove completed work.
- **GitOps composer** — a separate composer for reviewing changed files and sending diff comments.
- **Inbox** — recent local session activity in one place.
- **Artifacts** — preview generated HTML/React-ish output without leaving the app.
- **Voice input** — local dictation through sherpa-ONNX, running on CPU.
- **Skills**: browse, install, remove, and configure skills from inside the app.
- **Pi Durable conversations**: persistent history, queued messages, and conversation forks. Legacy Pi coding-agent extensions are not loaded.
- **Browser access** — use the local server from your machine, LAN, or Tailscale.

## What it deliberately is not

- A general-purpose code editor.
- A polished SaaS IDE.
- A safe multi-tenant server for strangers.
- A replacement for understanding what your agent is doing.

It is a cockpit for local/remote-ish agent work on a machine you trust.

## Browser access

Start the server:

```bash
bunx howcode
```

To access it from another device on your network:

```bash
bunx howcode --host 0.0.0.0 --port 4173
```

For remote access, Howcode prints an access URL with a token:

```text
http://<server-ip>:4173/#token=<printed-token>
```

For a stable token:

```bash
bunx howcode --host 0.0.0.0 --port 4173 --token my-secret
# or
HOWCODE_HEADLESS_TOKEN=my-secret bunx howcode --host 0.0.0.0 --port 4173
```

Notes:

- Default host is `127.0.0.1`, with port `5173`. Local loopback access needs no token by default.
- Use `--host 0.0.0.0` only on a trusted network, Tailscale, WireGuard, etc.
- Browser-picked, pasted, or dropped files are uploaded to a temp folder on the host before attaching.
- Host file browsing still browses the host filesystem.
- Terminal actions happen on the host machine. Browser file uploads do not expose local filesystem paths.
- Microphone capture requires HTTPS or a loopback address. Plain HTTP access from another device cannot use dictation.
- This is not hardened SaaS auth. Treat it more like SSH with a UI.

## Run from source

```bash
bun install
bun run dev
```

Development serves the browser app through Vite and runs the backend under stock Node. Open the URL printed at startup.

To try dev mode from another device on your network:

```bash
bun run dev:host
# open http://<this-machine-ip>:5173/#token=<printed-token>
```

Build and run the production server:

```bash
bun run build
bun start
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
