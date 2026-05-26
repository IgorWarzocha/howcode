---
name: "Worktree completion summary"
description: "Use when Igor says a worktree seems complete and wants a branch/worktree summary saved for later review and merging"
---

# Worktree completion summary

## Goal

Create a short, useful summary file in the current worktree at:

```txt
branches/(parent-branch-name)/(worktree-name).md
```

These files live in each worktree until that worktree is merged, so future sessions can review all completed worktrees for a parent branch in one place before merging.

## Procedure

1. Confirm current repo/worktree context:

```bash
pwd
git branch --show-current
git rev-parse --show-toplevel
git worktree list --porcelain
```

2. Derive:
   - `worktree-name` from the current repo root basename, e.g. `/path/.worktrees/settings_view` → `settings_view`
   - `parent-branch-name` from the main/parent checkout in `git worktree list --porcelain`, not from the current worktree branch. In this repo that is usually the worktree at `/home/igorw/Work/howcode`.

3. Review the work against the parent branch:

```bash
git log --oneline --decorate --max-count=12
git status --short
git diff --stat "$parent_branch...HEAD"
```

4. Create the summary file inside the current worktree checkout:

```bash
mkdir -p "branches/$parent_branch"
```

Write a concise paragraph describing what was accomplished and why it matters. Keep it PR-ish, but not a full PR body.

Example:

```md
Reorganized Settings into clearer user-facing categories, grouped all Pi-backed settings under a single Pi section, and fixed worktree Biome checks so this branch can be reviewed and merged cleanly.
```

## Rules

- One short paragraph is the default; expand only when the work genuinely needs more context.
- Do not write a full PR template.
- Focus on what changed, why it matters, and anything a future merge/review session should know.
- Do not include test logs unless they affect merge confidence.
- Write the file in the current worktree, not by switching to or editing the parent checkout.
- If no separate parent checkout exists, fall back to the current branch name for `parent-branch-name`.
- After writing it, tell Igor the file path and keep the chat summary brief.
