> [!IMPORTANT]
> This is a one-man project. Only so many things I can check. Expect weird edge cases.
> Current release is the first properly working one, so I'll probably find some stuff myself.

# There are many desktop apps for coding with AI, but this one...

I've clanked a LOT. And during that clanking, I used a few apps. None of them really fit how I work. This one does. It's opinionated, focussed on UX and aimed at YOLOing with agents.

You won't find a file editor. You won't see a turn-by-turn diff. Some things might not instantly click. But when they do, you'll understand the idea behind all of it.

The UI is meant to speak for itself. When it doesn't, it's a fail. So if you don't "get it", file an issue. Tell me how to improve it. I might agree.

## Install

```bash
npx howcode
# or
npm i -g howcode
howcode
```

On first run, the launcher downloads the matching desktop build for your platform and caches it locally.

Check releases tabs for latest stable-ish version you can just download. Built on Linux, compatible with Mac and Windows.

## What you can do

- **Coding with Pi in a desktop environment** — the main dish.
- **Staying oriented across projects** — sidebar projects, pinned/archived threads, inbox collating all the recent messages.
- **Built in terminal** — with persisted transcript history, apparently.
- **Git-ops composer** — a separate view tailored to doing things with git.
- **Reviewing diffs** — comment-based workflow.
- **Pi as-is when you want it** — a Pi TUI takeover mode embedded inside the app.
- **Voice input** — local dictation through sherpa-ONNX, running on CPU.
- **Skills and extensions** — browse, install, remove, and configure Pi skills/extensions from inside the app.

## Coming next

The near-term direction is:

- more cards
- worktrees
- per-project automations
- multiple terminals per session
- external terminal control for agents
- responsive-layout polish
- background mode when Pi has a server, unless I find a workaround
- remote sessions over SSH, likely tied to that same server feature or me working around the lack of it

And additional views for just chatting, claw-like sidekick for the app and co-work-style environment.

## For developers

If you want to run from source:

```bash
bun install
bun run dev
```

## Issues and updates

- Bugs / requests: <https://github.com/IgorWarzocha/howcode/issues>
- Random updates: <https://x.com/Howaboua>
