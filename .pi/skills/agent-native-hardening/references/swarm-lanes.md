# Swarm Lane Templates

Use lanes as a planning primitive, not only as worker-agent branches. A lane can be:

1. **Discovery lane**: read-only exploration for evidence gathering, hotspot mapping, dependency tracing, or lane planning. It may be done directly or by an explore-style subagent. No worktree, edits, or commits required.
2. **Implementation lane**: a bounded code/doc change with one objective and clear validation. It may be done directly, by a coding subagent, or in a worktree/branch when parallelism or isolation helps.
3. **Stabilization lane**: integration, conflict resolution, full checks, and small fixes caused by previous lanes.

Choose the lightest mechanism that keeps the work safe and comprehensible. Prefer explore-style agents for broad reconnaissance; prefer worktrees only when parallel edits or risky refactors need isolation.

## Discovery Lane Templates

### Discovery A: Repo Map + Commands
- Scope: package/workspace layout, scripts, tsconfigs, test runners, lint/format tooling
- Goal: identify active checks and repo boundaries before scoring
- Output: command list, workspace map, missing/unclear checks

### Discovery B: Hotspots + Godfiles
- Scope: oversized files, catch-all folders, high fan-in/fan-out modules, mixed layers
- Goal: rank structural refactor candidates with file evidence
- Output: hotspot list with why each one hurts traversability or ownership

### Discovery C: Duplication + Boundary Drift
- Scope: repeated logic, duplicated DTOs/types, broad utils/helpers, cross-feature imports
- Goal: identify DRY and separation-of-concerns problems without inventing premature abstractions
- Output: duplicate patterns, proposed owner boundary, avoid/extract recommendation

### Discovery D: Type Safety Drift
- Scope: `any`, unsafe casts, flag bags, optional-field state objects, manual type copies, primitive soup
- Goal: find places where invalid states are representable or types drift across layers
- Output: candidate fixes using derived types, discriminated unions, or domain/branded types

## Implementation Lane Templates

### Lane A: Quality Gates
- Scope: scripts + tsconfig + lint boundaries
- Goal: repo-wide `check` includes all active lanes
- Typical files: root/package scripts, lane tsconfig files

### Lane B: Deterministic Tests
- Scope: pure logic tests only
- Goal: protect event transforms / reducers / guard handlers
- Typical files: `tests/**/*.test.ts` + script wiring

### Lane C: Hotspot Modularization
- Scope: split one large file by concern
- Goal: shrink hotspot and improve navigability
- Typical outputs: 2-4 new focused modules, no behavior change

### Lane D: Setup/Runtime Hardening
- Scope: process lifecycle and failure path logic
- Goal: explicit boundaries and invariant comments
- Typical outputs: runner/orchestrator split + helper modules

### Lane E: Discoverability
- Scope: strategic comments + one concise lane-map doc
- Goal: reduce reread cost for agents
- Rule: one doc max unless user requests more

### Lane F: Type/Contract Hardening
- Scope: domain types, schemas, API/client contracts, event payloads, ambiguous function signatures
- Goal: reduce invalid states, duplicated types, unsafe casts, ambiguous positional args, and boundary drift
- Typical files: schemas, DB models, API handlers, client contracts, domain types

## Stabilization Lane Template
- Scope: merge conflicts, full repo checks, breakages introduced by prior lanes
- Goal: make the final state coherent without expanding scope
- Rule: fix only real integration/hardening breakages; defer unrelated cleanup
