# Cursor desktop UI reference

Captured from local CDP on 2026-05-21. This is the new Cursor desktop app / Agents UI.

## Files

- `01-main.png` — initial view, old agent conversation at bottom with right terminal visible.
- `02-chat-top.png` — start of the agent thread.
- `03-chat-mid.png` — table/code-block area and first follow-up.
- `04-chat-late.png` — dense process log after follow-up.
- `05-chat-bottom.png` — final answer, composer, pills.
- `06-terminal-menu.png` — terminal side panel opened from the `6 Terminals` pill.
- `07-review-menu-or-panel.png` / `08-more-menu.png` — same right-panel state; useful mostly for terminal split layout.
- `09-terminal-closed-state.png` — right panel hidden, composer/pills visible.
- `10-review-open.png` — review click attempt while terminal panel remained open.
- `11-right-panel-hidden.png` — chat-only state after hiding right panel.
- `12-terminal-pill-open-after-hide.png` / `13-review-pill-open-after-hide.png` — pill interaction attempts; right panel stayed open.
- `14-more-pill-menu.png` — pin skill / marketplace menu above composer.
- `01-main-a11y.txt`, `01-main-dom.json`, `10-review-open-dom.json` — inspection dumps.

## What seems worth copying

- The chat is not card-first. Assistant content is mostly plain prose on the workspace plane.
- User prompts are compact rounded strips, a bit stronger than assistant text, but still quiet.
- Process work is a vertical ledger: `Thought`, `Explored`, `Edited`, `Monitored background task`. This is very relevant for Howcode tool calls.
- Tool/process rows are collapsible headers, not nested card blocks. They use text + muted metadata + green/red diff counts.
- Terminal and review are pills near the composer, not giant permanent toolbar sections. They feel like current-session capabilities.
- The terminal opens as a right split, not a modal. It stays visually native/editor-like.
- Composer is a docked input with integrated plus/model/voice/status. It is strong, but not huge.
- Status bar under composer is tiny: environment, branch, context. Good pattern for our footer.
- Sidebar row actions are very compact: selected row, tiny pin/archive actions, age at right.
- Sidebar project/repository groups are plain rows and section labels. Very little card chrome.

## What not to copy directly

- The UI is a bit too VS Code-specific for Howcode. We should not inherit editor tab clutter unless it maps to our app.
- Terminal/review clicks were hard to reason about from CDP; verify interactions manually before copying exact behavior.
- Some targets are visually tiny. Keep our hit areas better than this.
- The floating find widget appeared during inspection; ignore it as accidental state.

## Howcode implications

- Move tool calls from cards toward a compact process ledger. Think: `Edited index.html +16 -3`, `Ran 1 command`, `Read terminal`, `Thought for 11s`.
- Keep assistant prose unboxed. Reserve strips for user prompts, artifacts, review summaries, errors, and terminal/log objects.
- Make terminal/diff/review entry points session pills near the composer/footer.
- Consider a right split for terminal/diff/artifacts where appropriate, but keep it optional and quiet.
- Composer footer/status should be tiny and integrated: local/project, branch/baseline, context, model.
- Sidebar should keep contextual row actions and avoid permanent button clutter.
