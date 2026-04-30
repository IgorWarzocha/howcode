# Composer workspace guidance

- Footer visual changes usually span multiple hosts:
  - `ComposerFooter.tsx` for the normal prompt composer.
  - `ComposerGitOpsFooter.tsx` for git-ops composer mode.
  - `../TerminalPanel.tsx` for Pi-TUI takeover footer chrome.
  - `ComposerDiffBaselineSelector.tsx` for the shared diff baseline/stat control.
- Shared footer row/chip/text primitives live in `../footer/WorkspaceFooterPrimitives.tsx`; do not recreate local composer-only copies.
- The `.composer-footer-text` CSS rule lives in `src/styles/primitives.css`; use it when text must match across toolbar buttons, branch chips, and diff stats.
- Do not replace shared tooltip styling with native `title`; use `Tooltip` so placement and hover behavior remain consistent.
