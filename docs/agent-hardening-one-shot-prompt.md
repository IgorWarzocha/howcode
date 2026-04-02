# One-shot prompt: execute the hardening + ARIA plan

```md
You are working in the `howcode` repo.

Your mission is to execute the hardening and UI traversability plan in this repository in a careful, evidence-first way, using the local `agent-native-hardening` skill and the repo instructions.

## First read these files completely

1. `AGENTS.md`
2. `docs/agent-hardening-plan.md`
3. `/home/igorw/.pi/agent/skills/agent-native-hardening/SKILL.md`
4. `/home/igorw/.pi/agent/skills/agent-native-hardening/references/scoring-rubric.md`
5. `docs/lane-map.md`
6. `README.md`

Also inspect the current relevant implementation files before changing anything:

- `desktop/pi-desktop-runtime.cts`
- `desktop/pi-threads.cts`
- `desktop/thread-state-db.cts`
- `src/app/AppShell.tsx`
- `src/app/components/workspace/Composer.tsx`
- `src/app/components/sidebar/ProjectTree.tsx`
- `src/app/components/sidebar/Sidebar.tsx`
- `src/app/components/workspace/WorkspaceHeader.tsx`
- `src/app/components/settings/ArchivedThreadsPanel.tsx`
- `src/app/state/workspace.ts`
- `src/app/state/workspace.test.ts`
- `shared/desktop-contracts.ts`
- `src/bun/index.ts`

## Important operating rules

- Follow `AGENTS.md` strictly.
- Treat `docs/agent-hardening-plan.md` as the source plan unless code reality proves otherwise.
- Use the `agent-native-hardening` skill workflow: baseline, evidence sweep, lane planning, implementation, merge/stabilize, final report.
- Use `explore_subagent` first for evidence gathering before major edits.
- Prefer worktree/lane style execution when it reduces overlap.
- Do not overwrite or absorb unrelated user changes if the git tree is dirty.
- If the working tree is dirty, preserve those edits and work around them safely.
- Use commit as the primary validation step for major changes, per repo guidance.
- Commit after every major change.
- Do not run the full check suite by default unless needed; run targeted validation relevant to the lane, then use commits as the main gate.
- Prefer focused `apply_patch` edits.

## Primary outcomes

You have two top-level objectives:

1. execute the structural hardening plan so the biggest godfiles move toward single-purpose modules
2. improve UI accessibility and agent traversability so a CDP-driven agent can locate and operate the app using stable role/name/state queries instead of brittle CSS/text heuristics

## Success criteria

### Structural hardening

- Reduce the largest mixed-responsibility files by extracting cohesive modules.
- Keep public contracts stable unless a contract change is clearly justified.
- Deduplicate shared title/message mapping logic.
- Move orchestration logic out of view-heavy files where appropriate.
- Prefer small focused modules with obvious ownership.

### UI traversability / ARIA

- Every important interactive control has a stable accessible name.
- Dialogs are real dialogs.
- Popup triggers expose machine-readable open/closed state.
- Expanded/selected/current state is encoded with ARIA where appropriate.
- Major regions have semantic landmarks and labels.
- Hover-only actions are still discoverable to keyboard/CDP agents.

## Execute in this order unless evidence forces a better order

### Lane A — shared desktop thread/message utilities

Goal:

- extract shared pure helpers for title normalization and message mapping
- make both `desktop/pi-desktop-runtime.cts` and `desktop/pi-threads.cts` consume them

Expected outputs:

- a shared helper module for thread/message mapping
- reduced duplication in both desktop runtime files
- minimal deterministic tests for extracted pure transforms if practical

### Lane B — database layer split

Goal:

- split `desktop/thread-state-db.cts` by responsibility without breaking callers

Expected outputs:

- separate DB bootstrap/schema/query/write/mapping modules
- a thin public API surface or facade if needed

### Lane C — runtime/composer split

Goal:

- split `desktop/pi-desktop-runtime.cts` into focused modules

Expected outputs:

- runtime registry module
- attachment processing module
- thread publishing/event module
- composer service module
- facade entry module that is much easier to read

### Lane D — AppShell controller split

Goal:

- make `src/app/AppShell.tsx` mostly composition only, matching the lane map

Expected outputs:

- controller hook(s) for orchestration
- effect-specific hooks where helpful
- layout extraction if it materially improves traversability

### Lane E — UI decomposition

Goal:

- split `Composer.tsx` and `ProjectTree.tsx` into smaller purpose-built pieces

Expected outputs:

- subcomponents and/or controller hooks for composer
- subcomponents and/or controller hooks for project tree

### Lane F — ARIA and CDP traversability hardening

Use the audit in `docs/agent-hardening-plan.md` and implement the highest-value fixes first.

Priority fixes:

1. `src/app/components/settings/ArchivedThreadsPanel.tsx`
   - add proper dialog semantics: `role="dialog"`, `aria-modal`, `aria-labelledby`
   - ensure focus moves into the dialog on open and is restored on close if feasible
   - support Escape dismissal if appropriate

2. Popup/menu semantics
   - `src/app/components/sidebar/ProjectActionMenu.tsx`
   - `src/app/components/sidebar/SettingsMenu.tsx`
   - menu-like controls in `src/app/components/workspace/Composer.tsx`
   - product/menu-like controls in `src/app/components/workspace/WorkspaceHeader.tsx`
   - add `aria-haspopup`, `aria-expanded`, `aria-controls`, and menu roles where appropriate

3. Project tree state semantics
   - add `aria-expanded` and `aria-controls` on project expand/collapse controls
   - expose selected/current state for active nav/project/thread items
   - ensure row-level actions remain accessible when not hovered

4. Landmark labeling
   - label the sidebar
   - label the threads section
   - label the terminal panel or other major regions lacking labels

## Validation strategy

- Start by checking git status and assessing whether the tree is clean.
- If the tree is not clean, do not overwrite unrelated changes.
- For each major lane:
  - inspect the exact files affected
  - implement focused changes
  - run the smallest relevant validation possible
  - commit that lane as one atomic change
- Add or update deterministic tests only for extracted pure logic or reducers/helpers.
- If there are existing tests covering touched logic, run only those relevant tests unless the full suite becomes necessary.

## Reporting requirements

At the end, report in this format:

1. Findings implemented, ordered by severity/value
2. Updated scorecard (`agent_native`, `fully_typed`, `traversable`, `test_coverage`, `feedback_loops`, `self_documenting`) with before/after values and file-grounded evidence
3. Exact files changed per lane
4. Commits created
5. Remaining risks
6. Next-step options

## Additional guidance

- Prefer in-code discoverability over extra docs.
- Add comments only for invariants, side effects, ownership boundaries, and non-obvious control flow.
- Keep changes mergeable and incremental.
- If one lane becomes too risky, narrow the scope and finish the highest-confidence slices first.
- If code reality conflicts with the plan, say so explicitly and revise based on evidence.

Now execute the plan.
```
