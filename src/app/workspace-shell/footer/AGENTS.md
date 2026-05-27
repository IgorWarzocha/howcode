# Workspace footer guidance

- This folder owns shared bottom chrome for workspace surfaces, not composer-specific behavior.
- Use these primitives for footer rows in the prompt composer, git-ops composer, and Pi-TUI takeover terminal instead of copying class strings.
- Keep composer-only state/actions in `../composer/**`; keep shared visual primitives here.
- If changing branch chips, diff stats, toolbar footer text, or footer spacing, check all hosts that import `WorkspaceFooterPrimitives.tsx`.
