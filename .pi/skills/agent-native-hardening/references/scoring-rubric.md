# Scoring Rubric (0-10)

Apply an explicit godfile penalty during scoring. A repo with unresolved godfiles, catch-all folders, or persistent mixed-concern modules should not receive a high structure score just because it is typed or tested.

## 1) agent_native
0-2: monoliths/godfiles, unclear ownership, no guardrails
3-5: partial modularization, weak lane boundaries, mixed concerns still central
6-8: clear feature modules, low duplication, boundaries enforced by scripts/lint
9-10: lane-safe architecture, deterministic extension points, feature ownership is obvious and DRY

## 2) fully_typed
0-2: mostly untyped / pervasive `any`
3-5: TS enabled but weak strictness, unsafe casts, duplicated DTOs, or flag-bag states
6-8: strict configs in major lanes, limited unsafe edges, types mostly derived from source of truth
9-10: strict everywhere, clean request/event/domain typing, invalid states modeled out, end-to-end type flow preserved where tooling supports it

## 3) traversable
0-2: hard to locate ownership and flows, godfiles dominate navigation
3-5: partial structure, large hotspots remain, feature boundaries blurry
6-8: clear feature folders, reduced hotspots, entrypoints mostly obvious
9-10: small focused modules with stable entrypoints and crisp separation of concerns

## 4) test_coverage
0-2: no tests
3-5: minimal deterministic tests for core transforms
6-8: broad deterministic unit coverage across lanes
9-10: robust unit + integration + failure-path coverage

## 5) feedback_loops
0-2: no consistent checks
3-5: lint/typecheck only in one lane
6-8: repo-wide lint/typecheck/test wired into `check`
9-10: fast, reliable, enforced CI-style local gates

## 6) self_documenting
0-2: stale docs, no strategic comments, structure hides ownership
3-5: partial comments/docs, weak discoverability, mixed concerns still require rereads
6-8: strategic comments + concise lane map + feature ownership mostly obvious
9-10: high signal comments, accurate map, no stale docs, file/folder layout explains the system

## Godfile / Boundary Criteria

Treat these as strong negative signals:
- one file or folder absorbing unrelated features, orchestration, IO, types, and UI
- repeated cross-feature edits landing in the same catch-all module
- broad `utils`/`helpers`/`misc` dumping grounds with weak ownership
- copy-paste logic across features where a stable shared abstraction should exist
- hidden side effects or mixed layers that make extraction risky

Treat these as strong positive signals:
- godfiles decomposed into feature folders with clear ownership
- feature-local modules separated by concern where needed (`index`/entrypoint, domain logic, IO, types/schema, tests)
- shared abstractions extracted only when genuinely cross-feature and stable
- discriminated unions, domain/branded types, and derived types replace ambiguous primitives or manually duplicated shapes
- lower fan-in/fan-out per module and fewer unrelated edits per lane

Suggested score caps:
- any active godfile hotspot: cap `agent_native` and `traversable` at 5
- multiple godfiles or godfolders: cap `agent_native`, `traversable`, and `self_documenting` at 4
- persistent duplication plus mixed concerns: cap `agent_native` at 6 until shared ownership is clarified
