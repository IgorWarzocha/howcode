---
name: gh-issue-pr-flow
description: Runs this repo's GitHub issue and PR workflow with gh. Use when the user mentions issue numbers, PR links, or the project board, asks to pick a manageable issue, wants an issue rewritten into a proper issue, wants backlog triage or relabeling, or wants a PR opened, updated, or reviewed. Do not use for local-only git work with no GitHub issue or project flow.
---

# GH Issue PR Flow

## Purpose
Use GitHub issues as the working brief for this repo. This skill covers four related jobs:

1. pick the right issue to work on
2. rewrite vague issues into proper issues, epics, and sub-issues
3. implement issue-backed work on a fresh branch from `dev`
4. open and maintain clean PRs with good GitHub hygiene

Do not treat every issue as immediately buildable. First decide whether it is a good leaf issue, a parent issue, a research item, or something that should be rewritten before coding.

## Critical rules
- Treat the issue body as the initial problem statement or prompt.
- Read the full issue, including comments, before coding.
- Prefer actionable leaf issues over epics. Epics are containers unless the user explicitly asks for backlog cleanup or epic design work.
- If the user says “pick an issue” or “work on something manageable”, use the project board and the issue-selection rules in `references/issue-selection.md` before choosing.
- If an issue is mushy, multi-part, or mixes discovery with implementation, rewrite or split it before coding.
- When rewriting an existing issue, preserve the user's original text at the bottom under `## Original issue text` as a blockquote.
- New or rewritten issues should follow the writing rules in `references/issue-writing.md`.
- If PR or release work touches GitHub Actions, artifact uploads, or release packaging, check `references/actions-artifact-retention.md` so workflow changes match the repo's storage policy.
- Start new work from a fresh local branch based on `dev`.
- Open the PR back into `dev`, not `main`, unless the user explicitly says otherwise.
- If the issue asks for discussion first or is clearly not actionable yet, stop and explain instead of forcing implementation.
- Only use auto-closing keywords such as `Closes #123` for issues that are fully resolved by the PR. Use `Refs #123` for anything partial.
- Before any build or release pass in this flow, refresh the landing changelog in `src/app/views/landing-overview-content.ts` from recent merged PRs / `origin/dev` commits so the shipped app does not carry stale release notes.

## When to use
- The user gives issue numbers like `#123` or `123`.
- The user sends issue or PR links.
- The user sends the GitHub project link or asks what should be worked on next.
- The user asks you to pick a manageable issue.
- The user asks you to rewrite, relabel, split, or organize issues.
- The user asks to create an issue from the current conversation.
- The user asks to open, update, or finish a PR with `gh`.
- The user asks to check or act on Codex review feedback.

## Do not use when
- The task is explicitly local-only and not tied to GitHub.
- The issue is really a discussion starter, discovery task, or wishful idea that cannot be implemented yet.
- The request would need destructive repo actions beyond the normal branch and PR flow without explicit confirmation.
- The user wants a broad product strategy conversation with no intent to track or implement work yet.

## Inputs expected
### Required
- An issue number, issue URL, PR URL, project URL, or explicit request to create or rewrite issues.

### Optional
- Related issues to close or reference.
- A preferred branch name or PR title.
- Review findings from the user's `/review` command.
- Existing Codex review comments on the PR.
- A preference such as “pick something small”, “pick a P0”, or “just clean up the issues”.

## Prerequisites
- `gh` is authenticated for this repo.
- The repo has an up-to-date `dev` branch locally and on `origin`.
- Use `gh` for issue and PR operations unless the user explicitly wants browser-only handling.
- If the user asks for project-board triage, `gh` must also have project scopes.
- This repository's working branch is `dev`; open PRs into `dev` unless the user explicitly says otherwise.

## Workflow
### 1. Resolve the work mode
1. If the user is describing a problem that should become tracked work, create or rewrite issues first.
2. If the user gives an issue number or link, open it with comments and read everything relevant.
3. If the user gives a PR link, read the PR state, description, and comments before acting.
4. If the user asks what should be worked on next, inspect the project board and apply `references/issue-selection.md`.

Useful commands:

```bash
gh issue view <number> --comments
gh issue view <url> --comments
gh pr view <number-or-url> --comments
gh project item-list 3 --owner IgorWarzocha --limit 100 --format json
```

### 2. Triage before coding
1. Decide whether the work item is a leaf issue, epic, research item, or rewrite candidate.
2. If the user asked you to pick something, prefer `Ready` leaf issues, then apply priority and manageability rules from `references/issue-selection.md`.
3. If the issue explicitly calls for discussion first, or is obviously not implementable yet, stop and tell the user why.
4. If the issue is partially actionable, state the shippable subset before starting.
5. If the issue should be split or rewritten first, do that before opening a coding branch.

### 3. Rewrite or create issues when needed
1. Use the templates and rules in `references/issue-writing.md`.
2. Assign the right issue type: epic, feature, bug, or research.
3. Add area and priority labels.
4. If rewriting an existing issue, keep the original text at the bottom under `## Original issue text`.
5. If a parent-child structure is needed, create the children and link them.
6. Update project fields so the board stays meaningful:
   - `Ready` means real next work
   - `Backlog` means valid but not next
   - epics are usually containers, not active implementation cards

### 4. Branch from `dev`
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

### 5. Implement the work
1. Treat the issue as the brief.
2. Make the requested changes.
3. If the issue scope shifts materially, call that out before continuing.
4. If you discover the issue was not actually leaf-sized, stop and split or rewrite the backlog instead of quietly sprawling.

### 6. Run the review loop
1. When implementation is done, expect the user to run their internal `/review` command.
2. Fix the issues that review finds.
3. Repeat until the review comes back clean or the remaining tradeoffs are explicitly accepted.
4. If the user shares review findings in chat instead of rerunning the command, resolve them the same way.

### 6.5. Refresh the landing changelog before builds
1. If you are about to make a build, package, release artifact, or other ship-intended output, update `src/app/views/landing-overview-content.ts` first.
2. Base the changelog on actual merged PRs and recent `origin/dev` commits, not memory.
3. Keep it terse and user-facing; do not dump issue numbers or internal workflow noise into the app UI.
4. If nothing user-visible changed since the last refresh, say so explicitly instead of inventing changelog churn.

### 7. Open a clean PR with good hygiene
1. Push the branch if needed.
2. Create a PR targeting `dev`.
3. Write a detailed PR body with:
   - a concise summary of the change
   - notable implementation details if they matter to reviewers
   - any validation or review loop summary worth preserving
   - `Closes #n` for fully resolved issues
   - `Refs #n` for related but not fully closed issues
4. Prefer a squash-merge-ready PR description from the start.
5. If the PR changes Actions workflows, artifact uploads, or release triggers, validate it against `references/actions-artifact-retention.md` before opening or updating the PR.

Useful commands:

```bash
git push -u origin <branch-name>
gh pr create --base dev --fill
gh pr edit <pr-number> --body-file <file>
```

### 8. Ask Codex for review
Post this exact PR comment after the PR is up:

```text
@codex please review this PR and give me 10-20 issues if any
```

Useful command:

```bash
gh pr comment <pr-number-or-url> --body "@codex please review this PR and give me 10-20 issues if any"
```

### 9. Triage Codex feedback on request
1. Do not wait by default after posting the Codex review request.
2. Return the PR link to the user once the PR and comment are up.
3. Only inspect new PR comments or review events when the user explicitly asks you to check feedback.

Useful command:

```bash
gh pr view <pr-number-or-url> --comments
```

### 10. Triage Codex feedback
1. Read all Codex findings.
2. Fix the ones that are clearly correct and immediately actionable.
3. Ignore or flag the ones that are weak, irrelevant, or based on a bad assumption.
4. After fixes, summarize which items were addressed and which were dismissed, with brief reasons for the dismissals.
5. If the fixes are meaningful, go through the review loop again before declaring the PR ready.

## References
- `references/issue-selection.md` — how to choose manageable work and when to leave items alone
- `references/issue-writing.md` — how this repo wants issues, epics, labels, and original-text preservation handled
- `references/actions-artifact-retention.md` — how this repo wants GitHub Actions artifact retention, dev artifacts, PR packaging validation, and release uploads handled

## Validation
- If the user asked for issue selection, the chosen issue is a manageable leaf issue rather than an epic or mushy umbrella issue.
- If the user asked for issue cleanup, the rewritten issues follow the house format and preserve original text.
- The issue or PR was fully read before action.
- New work started from a branch created off current `dev`.
- The PR targets `dev` explicitly.
- The PR body clearly distinguishes `Closes` from `Refs`.
- The user's `/review` findings were addressed or explicitly called out.
- If the flow included a build or release pass, `src/app/views/landing-overview-content.ts` was refreshed first from real merged PRs / `origin/dev` history.
- If the flow touched GitHub Actions workflows, artifact retention and upload behavior still match `references/actions-artifact-retention.md`.
- Codex was asked for review.
- The PR link was returned to the user after posting the review request.
- Codex feedback was triaged instead of accepted blindly when the user asked for feedback handling.

## Error handling
### Error: issue is not actionable yet
Action: explain why, outline the blocker, and stop instead of opening a coding branch.

### Error: user asked to “pick an issue” but nothing is clearly ready
Action: do not guess blindly. Return a short ranked shortlist and explain what makes each option manageable or blocked.

### Error: issue is too broad, mushy, or mixed-purpose
Action: rewrite or split it first using `references/issue-writing.md`.

### Error: `dev` is behind or diverged
Action: sync `dev` first. Do not branch from stale state.

### Error: PR accidentally points to `main`
Action: correct the PR base to `dev` immediately.

### Error: Codex does not reply yet
Action: only check when the user asks. If there is still no reply, report that clearly.

### Error: Codex reports low-value issues
Action: do not churn on them. Fix the real ones, then note why the others were dismissed.

## Output contract
The completed flow should leave:
- a clearly chosen or clearly rewritten issue when the request was about backlog triage
- an issue-backed implementation branch created from `dev`
- a PR targeting `dev`
- a detailed PR description with correct closing references
- a Codex review request comment on the PR
- the PR link returned to the user
- a short triage summary of which review findings were fixed and which were dismissed when feedback triage was requested

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
2. Write it as a proper issue rather than dumping raw chat text.
3. Read back the created issue as the working brief.
4. Branch from fresh `dev`.
5. Implement, review, open the PR, and continue the normal flow.

### Example 3
User says: "Pick a manageable issue and work on it."

Expected behaviour:
1. Inspect the project board.
2. Prefer `Ready` leaf issues over epics and research items.
3. Choose a P0/P1 issue that is clearly actionable now.
4. Explain briefly why it was chosen.
5. Continue the normal implementation flow.

### Example 4
User says: "These issues are a mess. Rewrite them into proper issues and sub-issues."

Expected behaviour:
1. Read the existing issues.
2. Split epics from leaf work.
3. Rewrite titles and bodies using the issue-writing reference.
4. Preserve the original text at the bottom of rewritten issues.
5. Update labels, parents, and project fields so the board makes sense.

### Example 5
User says: "Check Codex feedback on this PR and handle the good points only."

Expected behaviour:
1. Read the PR comments and review state.
2. Separate actionable findings from weak ones.
3. Fix the worthwhile items.
4. Summarize what was fixed and what was dismissed.
