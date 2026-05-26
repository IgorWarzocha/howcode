---
name: "Worktree completion summary"
description: "Use when Igor says a worktree seems complete and wants a branch/worktree summary saved for later review and merging"
---

# Worktree completion summary

## Goal

Create a short, useful summary file at:

```txt
/branches/(branch-name)/(worktree-name).md
```

These files help future sessions review all completed worktrees for a branch in one place before merging.

## Procedure

1. Confirm current repo/worktree context:

```bash
pwd
git branch --show-current
git rev-parse --show-toplevel
```

2. Derive:
   - `branch-name` from `git branch --show-current`
   - `worktree-name` from the repo root basename, e.g. `/path/.worktrees/settings_view` → `settings_view`

3. Review the work:

```bash
git log --oneline --decorate --max-count=12
git status --short
```

If needed, compare against the parent/main branch with a focused command such as:

```bash
git diff --stat main...HEAD
```

4. Create the summary file:

```bash
mkdir -p "/branches/$branch_name"
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
- If the repo is not in a worktree, still create the file using the current checkout basename as `worktree-name`.
- After writing it, tell Igor the file path and keep the chat summary brief.
