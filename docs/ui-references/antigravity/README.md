# Antigravity UI reference

Captured from local CDP on 2026-05-21. These are reference shots for the Howcode de-cardification pass.

## Files

- `01-main.png` — initial main view with quota toast.
- `02-main-dismissed.png` — main empty workspace after toast dismissed.
- `03-model-menu.png` — composer model menu.
- `04-plus-menu.png` — composer add-context menu.
- `05-local-menu.png` — local-mode menu attempt; same visible state as add-context menu.
- `06-history.png` — conversation history view.
- `07-scheduled-tasks.png` — scheduled tasks view.
- `08-settings.png` — project permissions/settings modal.
- `09-settings-appearance.png` — appearance settings.
- `10-settings-models.png` — model quota settings.
- `11-settings-conversations.png` — repeated model view after nav miss; keep only as extra context.
- `initial-a11y.txt`, `02-main-dismissed-a11y.txt` — accessibility snapshots.
- `01-main-dom.json`, `inspected-elements.json` — rough DOM/style inspection dumps.

## What seems worth copying

- The app uses cards, but they are quiet: low-contrast borders, no big shadows, very little color, and surfaces sit close to the background.
- Sidebar rows are mostly flat. Active selection is a muted fill, not a loud card.
- Main workspace is mostly empty plane. The composer is the only strong object.
- Composer controls are grouped inside one soft surface. The lower metadata row is part of the same object, not another card.
- Menus are small, dark, low-shadow trays. They use row hover/selection instead of boxed menu items.
- History and scheduled tasks use page structure plus inputs/rows. They do not wrap the whole content in a dashboard card.
- Settings uses contained groups, but the card treatment is muted enough that the rows matter more than the containers.
- Settings left nav is just rows on a darker rail. It avoids icon clutter and large category cards.

## What not to copy directly

- Their settings modal is very large and modal-heavy. Howcode should keep native/workbench feel and avoid adding more modal dependence.
- The composer may be too visually centered/empty for Howcode. We need to preserve our denser project/thread workflow.
- The main UI is almost too low-contrast in places. Howcode still needs clearer running/error/dirty/selected states.
- Some interaction targets look visually small. Keep our hit area discipline.

## Translation for Howcode

- Keep cards where they represent a real object: composer, terminal/diff, popovers, maybe artifact surfaces.
- Turn repeated cards into lists: extensions, skills, top sessions, settings rows, tool calls.
- Replace card grids with section headers, rows, separators, and tonal bands.
- Reduce default shadows. Use `box-shadow` mostly for overlays/popovers, not every panel.
- Make borders thinner by perception: lower alpha, fewer nested borders, more shared row dividers.
- Let the workspace background show through. Do not put a panel around every page.

## Chat/thread pass added after Igor pointed out the miss

- `12-new-chat.png` — new empty chat state.
- `13-chat-draft.png` — composer with typed prompt, send affordance visible.
- `14-old-convo-open.png` — old conversation selected from sidebar; bottom-ish thread state.
- `15-review-panel.png` — old conversation with review/files-changed strip visible.
- `16-old-convo-top.png` / `20-old-convo-scroll-top.png` — start of populated conversation.
- `21-old-convo-scroll-early.png` — artifact approval/proceeded strip and assistant response.
- `22-old-convo-scroll-mid.png` — long assistant prose treatment.
- `23-old-convo-scroll-late.png` — error/debug answer with inline code pills and section dividers.
- `24-old-convo-scroll-bottom.png` — later review/file-change summary area.
- `25-sidebar-row-actions.png` — selected sidebar conversation with inline row actions and context menu.
- `26-sidebar-convo-action-menu.png` — attempted sidebar action capture; verify before relying on it.
- `27-project-settings-action.png` — project settings opened from sidebar project action.
- `14-old-convo-open-a11y.txt`, `14-old-convo-dom.json`, `15-review-panel-dom.json` — inspection dumps for the populated conversation.

## Chat/thread observations

- User prompts are compact rounded strips, not big chat bubbles. They sit in the same narrow content column as assistant text.
- Assistant output is mostly naked prose on the workspace plane. No enclosing assistant card.
- Work metadata is tiny and separate: `Worked for 20s` / `Worked for 1m` with a chevron. This keeps process chrome quiet.
- Artifacts/review objects are muted rows/strips. They read as attached objects, not promo cards.
- File-change summary is a single thin contained row with green/red counts and a Review button. Good model for our diff entry point.
- Inline code uses small amber-ish pills. It gives technical texture without wrapping every block in a heavy card.
- Section dividers are simple horizontal rules inside prose. Good for long assistant answers.
- Feedback/copy controls sit as tiny icon groups at the edge of message metadata, not persistent button bars.
- Sidebar row actions appear only when the row is active/hovered. The row stays quiet: selected fill, compact title, small age, tiny actions.
- Sidebar project actions are tiny icon affordances near the project label, not full buttons.

## Howcode implications from the chat pass

- Our thread timeline should lose most assistant-message card chrome. Keep prose on the plane.
- User messages can stay as compact strips, but should not become large rounded cards.
- Tool calls should become quiet process rows/disclosures: `Worked…`, `Ran…`, `Changed…`, `Reviewed…` rather than big nested panels.
- Diff/review entry should be one muted strip with counts and an action, close to Antigravity's `5 files changed +385 -17` row.
- Sidebar should lean harder into row actions on hover/selected state instead of always-visible local chrome.
- Composer should stay strongly anchored, but the thread above it should stay visually lighter.
