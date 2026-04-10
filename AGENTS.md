# AGENTS

- Pre-commit hooks exist. Do not run checks, lint, or format separately by default.
- Use Bun for installs and script execution (`bun install`, `bun run ...`), not npm.
- Electrobun is the desktop runtime. Prefer `/home/igorw/Work/howcode/src/bun/index.ts` + shared RPC contracts over reviving legacy desktop IPC shims.
- Use commit as the primary validation step for major changes.
- Commit after every major change.
- Mock/partial UI status markers are centralized in `src/app/features/feature-status.tsx`.
- Grep `feature:` to find status-tagged UI features quickly.
- Grep `FeatureStatusBadge`, `getFeatureStatusButtonClass`, or `data-feature-id` to find where a mock/partial feature is surfaced in the UI.
- UI updates must be optimistic; persist to the DB in the background.
- Reuse established UI structure, components, and styling; avoid one-off patterns unless explicitly requested.
- Keep UI self-explanatory; prefer strong visual cues over explanatory copy.
- Default interactable UI controls to lucide icon affordances with hover/tooltip text rather than persistent button labels, unless the user explicitly asks for visible text.
- UI must flow; popovers and transitions should stay aligned to their source element.
- Editing a field must not change layout metrics; keep size, spacing, and typography stable unless asked otherwise.
