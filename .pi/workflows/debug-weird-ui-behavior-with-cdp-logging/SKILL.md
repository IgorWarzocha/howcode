---
name: "Debug weird UI behavior with CDP logging"
description: "Use when weird app/UI behavior needs live reproduction and tracing, including flicker, stale state, remounts, focus/scroll jumps, action glitches, or ordering flashes"
---

# Debug weird UI behavior with CDP logging

Use this when the app does something weird and the behavior must be observed live: refreshes, remounts, flickers, rows briefly unfolding, wrong ordering for a moment, state changing then reverting, actions firing twice, stale UI, unexpected navigation, focus loss, scroll jumps, or anything where code inspection alone is likely to lie.

## Rules

- Reproduce in the running dev app. Do not guess from code only.
- Use CDP against Electron (`CDP_PORT=39217`) when possible.
- Instrument the page with a small in-page logger before performing the action.
- Only act on disposable data.
  - Create temp branches/worktrees/projects/sessions when needed.
  - Use obvious names like `cdp-debug-*` or `tmp-*`.
  - Delete/clean them up after the test.
  - Do not use important branches, real user sessions, or serious project data for destructive actions.
- If a destructive action is required, make the temporary object first, verify it appears, then delete that object only.

## CDP setup

List targets:

```bash
CDP_PORT=39217 /home/igorw/.pi/agent/skills/chrome-cdp/scripts/cdp.mjs list
```

Use the target id prefix from `list` in later commands.

## Install a DOM mutation logger

Adapt selectors to the surface being debugged. For sidebar branch/worktree flicker, this logger captures row labels, expanded state, and scroll position:

```bash
CDP_PORT=39217 /home/igorw/.pi/agent/skills/chrome-cdp/scripts/cdp.mjs eval <target> '(() => {
  window.__uiDebug?.observer?.disconnect?.()
  const root = document.querySelector(".sidebar-project-work-section")
  window.__uiDebug = { events: [], startedAt: Date.now() }
  const labels = () => Array.from(document.querySelectorAll(".sidebar-project-work-branch-toggle"))
    .map((el) => ({
      text: el.textContent.trim(),
      expanded: el.getAttribute("aria-expanded"),
      disabled: el.hasAttribute("disabled"),
    }))
  const snap = (reason) => window.__uiDebug.events.push({
    t: Date.now(),
    dt: Date.now() - window.__uiDebug.startedAt,
    reason,
    labels: labels(),
    scrollTop: document.querySelector(".sidebar-project-work-scroll-shell")?.scrollTop ?? null,
  })
  snap("install")
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((m) => m.type === "childList" || m.type === "attributes")) return
    snap("mutation:" + mutations.map((m) =>
      m.type + (m.attributeName ? ":" + m.attributeName : "") + ":+" + m.addedNodes.length + ":-" + m.removedNodes.length
    ).slice(0, 8).join(","))
  })
  if (root) observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "data-current", "data-divider-after", "data-divider-before"],
  })
  window.__uiDebug.observer = observer
  return labels().slice(0, 20)
})()'
```

## Reproduce with temp data

Example pattern:

1. Create a temp thing (`cdp-debug-*`).
2. Confirm it appears.
3. Add a manual marker before the suspect action:

```bash
CDP_PORT=39217 /home/igorw/.pi/agent/skills/chrome-cdp/scripts/cdp.mjs eval <target> '(() => {
  window.__uiDebug.events.push({ reason: "before-action", t: Date.now(), dt: Date.now() - window.__uiDebug.startedAt })
  return true
})()'
```

4. Perform the suspect action.
5. Dump recent events:

```bash
CDP_PORT=39217 /home/igorw/.pi/agent/skills/chrome-cdp/scripts/cdp.mjs eval <target> '(() => window.__uiDebug?.events?.slice(-80))()'
```

## What to look for

- Full page reload:
  - CDP state disappears, `window.__uiDebug` is gone, or Vite logs full reload.
  - Check dev server watcher config, especially generated folders/worktrees.
- Real component/state flicker:
  - Logger persists and shows multiple DOM mutations.
  - Compare snapshots before/after each mutation.
  - Look for stale mixed sources of truth: cache patched before related query/state refreshed, or vice versa.
- Remount/state reset:
  - Local UI state resets while no page reload happened.
  - Check keys, conditional rendering, parent state sync effects, and broad query writes.

## Fix strategy

- Prefer one consistent state transition over optimistic patch + stale secondary state.
- If UI derives from two sources, update them in an order that avoids impossible intermediate states.
- Preserve object references on broad cache merges when data is unchanged.
- Avoid full-shell/query refreshes for localized mutations.
- Add a regression test for the specific ordering/reference behavior when practical.

## Cleanup

- Remove temp branches/worktrees/projects/sessions created for the test.
- Re-run the logger after the fix with a fresh temp object.
- Keep unrelated local changes unstaged.
- Run the repo verification command when code changed.
