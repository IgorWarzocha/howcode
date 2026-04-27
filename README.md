> [!IMPORTANT]
> This is a one-man project. Only so many things I can check.
> Expect weird edge cases.

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

There's a launcher. It downloads the correct version.

Or check releases tabs for latest stable-ish version you can just download. 

Built on Linux, compatible with Mac and Windows (hopefully).

Works on my machine™

## What you can do

- **Coding with Pi in a desktop environment** — the main dish.
- **Sidebar stuff** — pretty much everything you'd expect. 
- **Inbox view** — collating all the recent messages.
- **Built in terminal** — with persisted transcript history, apparently.
- **Git-ops composer** — a separate view tailored to doing things with git.
- **Reviewing diffs** — comment-based workflow.
- **Pi as-is when you want it** — an embedded Pi TUI takeover mode.
- **Voice input** — local dictation through sherpa-ONNX, running on CPU.
- **Skills and extensions** — browse, install, remove, and configure Pi skills/extensions from inside the app.

## Coming next

The near-term direction is:

- more cards /s
- worktrees - please use only one session per project
- per-project automations
- multiple terminals per session
- external terminal control for agents
- responsive-layout polish
- background mode when Pi has a server, unless I find a workaround
- remote sessions over SSH... see above?

And additional views for just chatting, with some basic websearch etc., a claw-like sidekick for the app that can use it for/with you and co-work-style environment.

## For developers

If you want to run from source:

```bash
bun install
bun run dev
```

## Issues and updates

- Bugs / requests: <https://github.com/IgorWarzocha/howcode/issues>
- Random updates: <https://x.com/Howaboua>
- This project uses Vouch.
