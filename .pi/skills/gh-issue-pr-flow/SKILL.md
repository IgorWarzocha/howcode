---
name: gh-issue-pr-flow
description: Runs this repo's GitHub workflow with gh from issue intake through PR follow-up. Use when the user mentions issue numbers or GitHub links, asks to start work from an issue, wants a PR opened or updated, or wants Codex review triage on a PR. Do not use for local-only git work with no GitHub issue or PR flow.
---

# GH Issue PR Flow

## Purpose
Use GitHub issues as the working brief for this repo. Read the referenced issue and comments, decide whether it is actionable now, branch from `dev`, implement the work, iterate through the user's `/review` loop, open a squash-ready PR with strong GitHub hygiene, request Codex review, wait 10 minutes, then triage the review results.

## Critical rules
- Treat the issue body as the initial problem statement or prompt.
- Read the full issue, including comments, before coding.
- Start new work from a fresh local branch based on `dev`.
- Open the PR back into `dev`, not `main`, unless the user explicitly says otherwise.
- If the issue asks for discussion first or is clearly not actionable yet, stop and explain instead of forcing implementation.
- Only use auto-closing keywords such as `Closes #123` for issues that are fully resolved by the PR. Use `Refs #123` for anything partial.

## When to use
- The user gives issue numbers like `#123` or `123`.
- The user sends issue or PR links.
- The user asks to create an issue from the current conversation.
- The user asks to open, update, or finish a PR with `gh`.
- The user asks to check or act on Codex review feedback.

## Do not use when
- The task is explicitly local-only and not tied to GitHub.
- The issue is really a discussion starter, discovery task, or wishful idea that cannot be implemented yet.
- The request would need destructive repo actions beyond the normal branch and PR flow without explicit confirmation.

## Inputs expected
### Required
- An issue number, issue URL, PR URL, or explicit request to create a new issue.

### Optional
- Related issues to close or reference.
- A preferred branch name or PR title.
- Review findings from the user's `/review` command.
- Existing Codex review comments on the PR.

## Prerequisites
- `gh` is authenticated for this repo.
- The repo has an up-to-date `dev` branch locally and on `origin`.
- Use `gh` for issue and PR operations unless the user explicitly wants browser-only handling.
- Remember that this repository's GitHub default branch is `main`, so `gh pr create` must be told to use `--base dev` for this workflow.

## Workflow
### 1. Resolve the GitHub object
1. If the user is describing a problem that should become tracked work, create an issue first.
2. If the user gives an issue number or link, open it with comments and read everything relevant.
3. If the user gives a PR link, read the PR state, description, and comments before acting.

Useful commands:

```bash
gh issue view <number> --comments
gh issue view <url> --comments
gh pr view <number-or-url> --comments
```

### 2. Decide whether to act now
1. If the issue is actionable, continue immediately.
2. If it explicitly calls for discussion first, or is obviously not implementable yet, stop and tell the user why.
3. If the issue is partially actionable, state the shippable subset before starting.

### 3. Branch from `dev`
1. Fetch remotes.
2. Switch to `dev`.
3. Fast-forward `dev` from `origin/dev`.
4. Create a fresh branch from `dev` for the issue work.

Useful commands:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c <branch-name>
```

Branch naming should be issue-oriented and easy to trace, for example `issue-123-short-slug` or `issues-123-124-short-slug`.

### 4. Implement the work
1. Treat the issue as the brief.
2. Make the requested changes.
3. If the issue scope shifts materially, call that out before continuing.

### 5. Run the review loop
1. When implementation is done, expect the user to run their internal `/review` command.
2. Fix the issues that review finds.
3. Repeat until the review comes back clean or the remaining tradeoffs are explicitly accepted.
4. If the user shares review findings in chat instead of rerunning the command, resolve them the same way.

### 6. Open a clean PR with good hygiene
1. Push the branch if needed.
2. Create a PR targeting `dev`.
3. Write a detailed PR body with:
   - a concise summary of the change
   - notable implementation details if they matter to reviewers
   - any validation or review loop summary worth preserving
   - `Closes #n` for fully resolved issues
   - `Refs #n` for related but not fully closed issues
4. Prefer a squash-merge-ready PR description from the start.

Useful commands:

```bash
git push -u origin <branch-name>
gh pr create --base dev --fill
gh pr edit <pr-number> --body-file <file>
```

### 7. Ask Codex for review
Post this exact PR comment after the PR is up:

```text
@codex please review this PR and give me 10-20 issues if any
```

Useful command:

```bash
gh pr comment <pr-number-or-url> --body "@codex please review this PR and give me 10-20 issues if any"
```

### 8. Wait and check back
1. Wait 10 minutes before checking for a reply.
2. Then inspect new PR comments or review events.
3. If Codex has not replied yet, report that clearly and ask whether to wait longer or check again later.

Useful commands:

```bash
sleep 600
gh pr view <pr-number-or-url> --comments
```

### 9. Triage Codex feedback
1. Read all Codex findings.
2. Fix the ones that are clearly correct and immediately actionable.
3. Ignore or flag the ones that are weak, irrelevant, or based on a bad assumption.
4. After fixes, summarize which items were addressed and which were dismissed, with brief reasons for the dismissals.
5. If the fixes are meaningful, go through the review loop again before declaring the PR ready.

## Validation
- The issue or PR was fully read before action.
- New work started from a branch created off current `dev`.
- The PR targets `dev` explicitly.
- The PR body clearly distinguishes `Closes` from `Refs`.
- The user's `/review` findings were addressed or explicitly called out.
- Codex was asked for review.
- Codex feedback was triaged instead of accepted blindly.

## Error handling
### Error: issue is not actionable yet
Action: explain why, outline the blocker, and stop instead of opening a coding branch.

### Error: `dev` is behind or diverged
Action: sync `dev` first. Do not branch from stale state.

### Error: PR accidentally points to `main`
Action: correct the PR base to `dev` immediately.

### Error: Codex does not reply after 10 minutes
Action: report no reply yet, then wait longer only if the user wants that.

### Error: Codex reports low-value issues
Action: do not churn on them. Fix the real ones, then note why the others were dismissed.

## Output contract
The completed flow should leave:
- an issue-backed implementation branch created from `dev`
- a PR targeting `dev`
- a detailed PR description with correct closing references
- a Codex review request comment on the PR
- a short triage summary of which review findings were fixed and which were dismissed

## Examples
### Example 1
User says: "Take care of #182."

Expected behaviour:
1. Read issue `#182` and its comments.
2. Confirm it is actionable.
3. Branch from fresh `dev`.
4. Implement the change.
5. Work through the `/review` loop.
6. Open a PR to `dev` that closes `#182`.
7. Ask Codex for review and triage the response.

### Example 2
User says: "Create an issue for this bug, then fix it."

Expected behaviour:
1. Create the issue from the conversation.
2. Read back the created issue as the working brief.
3. Branch from fresh `dev`.
4. Implement, review, open the PR, and continue the normal flow.

### Example 3
User says: "Check Codex feedback on this PR and handle the good points only."

Expected behaviour:
1. Read the PR comments and review state.
2. Separate actionable findings from weak ones.
3. Fix the worthwhile items.
4. Summarize what was fixed and what was dismissed.
