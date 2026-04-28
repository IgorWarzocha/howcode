---
name: agent-native-hardening
description: "TypeScript/JavaScript codebase hardening: maintainability, code quality, architecture cleanup, repo scoring, agent-friendly structure, godfiles, feature folders, DRY, type safety, traversability, feedback loops, worktrees, subagents, swarm refactors."
---

# Agent Native Hardening

Use this skill when the user asks to review and improve a codebase for agent-native maintainability, especially requests like:
- "score this repo"
- "make this codebase agent-friendly"
- "improve code quality / maintainability"
- "clean up the architecture"
- "refactor with swarm/worktrees"
- "improve quality loops and structure"

## Must-Read References

Read these supporting files before applying the skill, not after improvising the workflow:
- `references/scoring-rubric.md` before any scorecard, findings list, or severity ranking.
- `references/swarm-lanes.md` before planning discovery lanes, implementation lanes, worktrees, or subagent splits.

If a reference file is missing or unreadable, say so and continue with the closest fallback, but do not silently skip it.

## Core Principles

1. Fail fast. Do not hide errors.
2. Prefer in-code discoverability over markdown sprawl.
3. Keep tests light and deterministic; avoid flaky integration tests unless requested.
4. Use lanes to separate evidence gathering and implementation. A lane can be a read-only exploration task, a direct coding pass, a subagent task, or a worktree branch depending on scope and risk.
5. Keep each lane focused, low-overlap, and easy to verify.
6. Prefer feature folders over catch-all files; godfiles must be extracted into clear feature-owned modules.
7. Push toward DRY and separation of concerns; remove copy-paste and mixed-responsibility modules without replacing them with new junk drawers.

## Required Scorecard

Always score these categories from 0-10 and explain evidence with file references:
1. `agent_native`
2. `fully_typed`
3. `traversable`
4. `test_coverage`
5. `feedback_loops`
6. `self_documenting`

Use rubric: `references/scoring-rubric.md`. Read it fully before assigning scores.
Always call out godfiles, mixed-concern modules, duplication hotspots, and feature-boundary violations in the evidence.

## Type Safety Policy

1. Make impossible states unrepresentable: prefer discriminated unions over boolean flag bags and optional-field state objects.
2. Use branded/domain types for validated primitives when values are easy to mix up, such as IDs, emails, paths, slugs, and external references.
3. Validate at IO boundaries, then pass trusted domain types internally.
4. Derive types from the source of truth instead of restating shapes by hand.
5. Preserve types across DB, server, client, and event/queue boundaries when project tooling supports it.
6. Prefer object parameters over positional arguments for functions with multiple ambiguous arguments.
7. Penalize pervasive `any`, unsafe casts, manually duplicated DTOs, and type drift between layers.

## Godfile + Boundary Policy

1. Treat a file or folder as a godfile hotspot when it acts as a catch-all for unrelated responsibilities, mixes layers, or keeps absorbing unrelated edits.
2. Godfiles must be broken apart into feature folders with clear ownership and small entrypoints.
3. Extract by feature first, then by concern inside the feature: keep orchestration, domain logic, IO, schemas/types, UI, and tests separated when the codebase shape allows it.
4. Enforce DRY by pulling repeated logic into the nearest stable shared boundary with a clear owner.
5. Do not "fix" duplication by creating a generic `utils` or `helpers` dumping ground; shared code still needs an explicit domain or platform owner.
6. Penalize codebases that retain godfiles, mixed-responsibility modules, or broad cross-feature coupling even if tests still pass.

## Execution Workflow

1. Baseline
- Confirm clean git state.
- Identify active check commands (`lint`, `typecheck`, `test`, `format:check`).

2. Evidence Sweep
- For non-trivial repos, use read-only discovery lanes first. These may be explore-style subagents or your own direct inspection.
- Discovery lanes return evidence only: files, commands, risks, ownership boundaries, and proposed next lanes.
- Verify discovery findings yourself before edits.
- Identify hotspots: oversized files, godfiles, missing feature boundaries, duplication, weak tests, stale docs.

3. Plan Lanes
- Split work into 3-6 lanes with minimal overlap.
- Read `references/swarm-lanes.md` before finalizing lanes.
- Choose the lightest lane mechanism that fits: direct edit, explore subagent, coding subagent, worktree, or integration branch.
- Worktrees and commits are recommended for parallel/high-risk implementation, not mandatory for every lane.
- Each implementation lane has one atomic objective and a clear validation command.

4. Implement or Coordinate
- Use subagents when they reduce context load or parallelize cleanly; otherwise implement directly.
- Require each implementation lane to run only relevant checks.
- Track exact changed files. If using worker agents or worktrees, require a commit message or merge summary.

5. Merge + Stabilize
- If worktrees/branches were used, merge lane branches into an integration branch.
- Resolve conflicts centrally.
- Run full repo checks.
- Fix only real breakages introduced by the hardening pass or lane merges.

6. Final Report
- Report findings first (by severity).
- Provide updated scorecard.
- Provide concise change log and remaining risks.

## Strategic Comment Policy

Add comments only where they reduce agent/human reread cost:
1. Invariants and assumptions.
2. Non-obvious control flow.
3. Side effects, ordering constraints, idempotency behavior.
4. Boundary ownership for modular lanes.

Avoid comments that restate obvious code.

## Structural Refactor Policy

1. Default repo shape should favor feature folders over layerless file piles.
2. When a file mixes multiple concerns, split it before adding more behavior.
3. When duplication appears across features, first check whether the behavior is truly shared and stable; if yes, extract it into an owned shared module, otherwise keep it feature-local.
4. Prefer small, composable modules with obvious ownership over giant "central" files.
5. In findings and final scoring, explicitly say whether the repo is moving toward or away from DRY and separation of concerns.

## Minimal Documentation Policy

1. Prefer one lane map doc over many docs.
2. Keep architecture docs short and file-reference-heavy.
3. If `README` is stale/template text, replace with project-specific quick map.
4. Do not create broad prose docs when comments + one map are sufficient.

## Test Policy

1. Add tests only for deterministic units:
- pure transforms
- reducers/state machines
- schema validation
- handler guards
2. Skip flaky E2E unless explicitly requested.
3. Wire tests into existing check pipeline.

## Deliverable Format

1. Findings (severity ordered)
2. Scorecard (before/after)
3. Refactor/implementation summary
4. Remaining risks and next step options
