---
name: "Temporary UI mock fixtures"
description: "How to add short-lived static fixtures for hard-to-reproduce UI states while tuning layout"
---

# Temporary UI mock fixtures

Use this when a UI state is hard to trigger repeatedly, such as queued prompts, ask-questions overlays, running extension status, or rare error strips.

## Rules

- Keep fixtures dev-only: gate with `import.meta.env.DEV` and an explicit URL flag such as `?mockQueuedPrompts=1`.
- Keep fixture data inside the component being tuned or a nearby `*.mock.ts` file.
- Never let mock data override real data. Prefer `real.length > 0 ? real : mock`.
- Use realistic strings that stress wrapping, truncation, and narrow composer widths.
- Do not commit fixture code unless the user explicitly asks for a reusable dev fixture. Usually remove it before commit.
- Commit the actual UI fix separately from any temporary fixture if the fixture is kept.

## Pattern

```ts
function getDevFixtures() {
  if (!import.meta.env.DEV) return []
  const params = new URLSearchParams(window.location.search)
  if (params.get('mockThing') !== '1') return []
  return [{ id: 'mock-1', text: 'Long realistic content...' }]
}

const visibleItems = realItems.length > 0 ? realItems : getDevFixtures()
```

Then open:

```txt
http://127.0.0.1:5173/?mockThing=1
```

## Cleanup checklist

Before committing production UI work:

1. Remove the mock helper and URL flag path.
2. Keep only the layout/style changes proven by the mock.
3. Run `bun run ai:check`.
4. Mention in the final note which mock flag was used and removed.
