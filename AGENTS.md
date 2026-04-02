# AGENTS

- Pre-commit hooks exist. Do not run checks, lint, or format separately by default.
- Use Bun for installs and script execution (`bun install`, `bun run ...`), not npm.
- Electrobun is the desktop runtime. Prefer `/home/igorw/Work/howcode/src/bun/index.ts` + shared RPC contracts over reviving legacy desktop IPC shims.
- Use commit as the primary validation step for major changes.
- Commit after every major change.
- Mock/partial UI status markers are centralized in `src/app/features/feature-status.tsx`.
- Grep `feature:` to find status-tagged UI features quickly.
- Grep `FeatureStatusBadge`, `getFeatureStatusButtonClass`, or `data-feature-id` to find where a mock/partial feature is surfaced in the UI.
