---
name: gh-stack
description: Manage GitHub stacked pull requests with `gh stack`. Use when creating stacked diffs, splitting work into dependent PRs, pushing/submitting/syncing/rebasing a stack, checking stack status, or navigating branch layers. Do not use for ordinary single-branch PR work.
---

# gh-stack

## Purpose

Use `gh stack` to operate a linear chain of dependent branches and PRs. This is the CLI operating manual; higher-level repo policy decides whether work should be stacked. Each branch builds on the one below it; the bottom branch targets trunk, and each higher PR targets the branch below.

```text
main <- feat/base <- feat/api <- feat/ui
       bottom                 top
```

## Critical rules

- Run `gh stack` non-interactively. Avoid commands or flags that open prompts/TUIs.
- Use `gh stack view --json`, never plain `gh stack view`.
- Use `gh stack submit --auto`, never plain `gh stack submit`.
- Pass branch names to `init`, `add`, and `checkout`; do not rely on prompts.
- If a stack has a prefix, pass only suffixes to `add`: with prefix `feat`, use `gh stack add api`, not `gh stack add feat/api`.
- Put changes in the right layer. If a higher layer needs a lower-layer change, move down, commit there, then `gh stack rebase --upstack`.
- Prefer normal `git add` and `git commit` over `gh stack add -Am` unless the change is clearly a single-commit layer.

## Setup

If the extension is missing:

```bash
gh extension install github/gh-stack
```

Before stack work in a repo, reduce prompt risk:

```bash
git config rerere.enabled true
git config remote.pushDefault origin
```

If multiple remotes exist and `remote.pushDefault` is not set, pass `--remote <name>` to `push`, `submit`, `sync`, `link`, and checkout/rebase flows that fetch or push.

## Common workflows

### Create a new stack

```bash
gh stack init -p feat base-layer
# edit files
git add <files>
git commit -m "Add base layer"

gh stack add api-layer
# edit files
git add <files>
git commit -m "Add API layer"

gh stack add ui-layer
# edit files
git add <files>
git commit -m "Add UI layer"

gh stack submit --auto
gh stack view --json
```

Use dependency order: shared types/schema/core code at the bottom; callers, UI, tests, and integration work above.

### Adopt existing branches

```bash
gh stack init --base main --adopt branch-a branch-b branch-c
gh stack submit --auto
```

List branches bottom-to-top.

### Check status

```bash
gh stack view --json
```

Inspect `branches[].name`, `branches[].isCurrent`, `branches[].needsRebase`, `branches[].isMerged`, and `branches[].pr`.

### Push or submit

```bash
gh stack push              # push branches only
gh stack submit --auto     # push and create/update PRs as draft by default
gh stack submit --auto --open
```

### Sync routine updates

```bash
gh stack sync
```

This fetches, fast-forwards trunk when possible, rebases stack branches, pushes, and refreshes PR state.

### Modify a lower layer

```bash
gh stack checkout feat/api-layer   # or: gh stack down / gh stack bottom
# edit files
git add <files>
git commit -m "Fix API layer"
gh stack rebase --upstack
gh stack push
```

Do not commit lower-layer work on an upper branch just because that is where you noticed it.

### Navigate

```bash
gh stack up [n]
gh stack down [n]
gh stack top
gh stack bottom
gh stack checkout <branch-or-pr-number>
```

Always provide an argument to `checkout`.

### Rebase and conflicts

```bash
gh stack rebase
gh stack rebase --upstack
gh stack rebase --downstack
```

On conflict:

1. Read stderr for conflicted paths.
2. Resolve conflict markers in files.
3. `git add <resolved-files>`.
4. `gh stack rebase --continue`.
5. If resolution is unsafe, `gh stack rebase --abort`.

### Restructure a stack

For reorder/rename/drop operations, prefer the interactive `gh stack modify` only when a human can operate the TUI. For agent-safe restructuring:

```bash
gh stack unstack --local       # use without --local only when intentionally changing GitHub stack state
# rename/delete/reorder branches with git
gh stack init --base main --adopt new-bottom new-middle new-top
```

Ask before destructive branch deletion or unstacking GitHub state.

### Link PRs without local stack state

Use this for branches managed by another tool, or when only GitHub stack linkage is needed:

```bash
gh stack link --base main branch-a branch-b branch-c
gh stack link 101 102 103
```

Arguments are bottom-to-top.

## Command reference

| Task | Command |
| --- | --- |
| Create stack with prefix | `gh stack init -p feat base` |
| Adopt branches | `gh stack init --base main --adopt branch-a branch-b` |
| Add top branch | `gh stack add next-layer` |
| View JSON | `gh stack view --json` |
| Push branches | `gh stack push` |
| Submit PRs | `gh stack submit --auto` |
| Submit ready PRs | `gh stack submit --auto --open` |
| Sync stack | `gh stack sync` |
| Rebase whole stack | `gh stack rebase` |
| Rebase above current branch | `gh stack rebase --upstack` |
| Continue conflict resolution | `gh stack rebase --continue` |
| Abort rebase | `gh stack rebase --abort` |
| Move through layers | `gh stack up`, `gh stack down`, `gh stack top`, `gh stack bottom` |
| Checkout stack/branch | `gh stack checkout <branch-or-pr>` |
| Remove local tracking | `gh stack unstack --local` |
| Link existing PRs/branches | `gh stack link <bottom> <middle> <top>` |

## Failure handling

- Extension missing: install `github/gh-stack` and retry.
- Repository not enabled for GitHub Stacked PRs: `submit`/`link` can fail; report that the GitHub feature must be enabled for the repo.
- Command hangs: assume an interactive prompt/TUI was triggered; cancel and rerun with explicit args/flags.
- Multiple remotes: set `git config remote.pushDefault origin` or pass `--remote <name>`.
- Branch belongs to multiple stacks: check out a specific non-shared stack branch before retrying.
- Remote checkout conflict prompt risk: if local and remote stack composition differ, remove local tracking with `gh stack unstack --local` before `gh stack checkout <pr-number>`.

## Output contract

When using this skill, final responses should include:

- stack branches changed or created, in bottom-to-top order
- commands run that affected stack state
- PR URLs/numbers when created or updated
- any unresolved conflict, prompt, or repository feature blocker
