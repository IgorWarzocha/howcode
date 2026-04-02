# AGENTS

- Pre-commit hooks exist. Do not run checks, lint, or format separately by default.
- Use commit as the primary validation step for major changes.
- Commit after every major change.
- Mock/partial UI status markers are centralized in `src/app/features/feature-status.tsx`.
- Grep `feature:` to find status-tagged UI features quickly.
- Grep `FeatureStatusBadge`, `getFeatureStatusButtonClass`, or `data-feature-id` to find where a mock/partial feature is surfaced in the UI.
