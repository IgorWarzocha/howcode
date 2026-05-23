# Pierre/Diffs CodeView assessment

## State now

- Howcode now uses `@pierre/diffs@^1.2.2`.
- `bun run ai:check` passes after the package bump.
- We still render diffs with the old Howcode-owned structure:
  - desktop returns one full patch string
  - renderer parses with `parsePatchFiles(...)`
  - Howcode owns the outer file virtualization via `@tanstack/react-virtual`
  - visible rows render Pierre `<FileDiff />`

So the package is current, but the architecture is still pre-`CodeView`.

## What changed upstream

Pierre now exposes `CodeView` from `@pierre/diffs/react`.

Useful bits:

- `CodeView` renders a mixed virtualized list of files and diffs in one scroll container.
- It accepts controlled `items` or imperative `initialItems`.
- Imperative handle supports:
  - `addItems(...)`
  - `updateItem(...)`
  - `updateItemId(...)`
  - `scrollTo(...)`
  - selected-line APIs
- `CodeViewItem` supports `type: 'diff'`, `fileDiff`, `annotations`, `version`, and `collapsed`.
- It has the hooks we care about:
  - `renderCustomHeader(item)`
  - `renderAnnotation(annotation, item)`
  - `renderGutterUtility(getHoveredLine, item)`
  - `selectedLines`
  - `onSelectedLinesChange`
- It owns virtualization, sticky headers, scroll anchoring, item measurement, and append/update fast paths.

This maps pretty well to our current use, but not perfectly.

## Likely good migration target

Replace this stack:

```txt
DiffPanelContent
  @tanstack/react-virtual
    DiffPanelFileRow
      FileDiff
```

with:

```txt
DiffPanelContent
  CodeView
```

Keep the changed-files tree outside CodeView for now.

## Things that look straightforward

- Custom file header: `renderCustomHeader(item)` can call our `DiffPanelFileHeader`.
- Comment annotations: `renderAnnotation(annotation, item)` has the item context we need.
- Gutter add-comment button: `renderGutterUtility(getHoveredLine, item)` matches current `FileDiff` usage.
- Collapsed files: `CodeViewItem.collapsed` exists.
- Split/unified: pass through `options.diffStyle`.
- Styling/theme: pass existing `unsafeCSS`, `theme`, `themeType`.
- Scroll-to-file/comment: `CodeViewHandle.scrollTo(...)` supports item/line/range targets.

## Things that need care

- Image diffs. Our current folded image behavior bypasses `<FileDiff />` entirely and only loads previews when unfolded/selected. `CodeView` only understands file/diff items, so custom image rows may need either:
  - keep image files outside CodeView, or
  - represent image previews as custom annotations/headers, or
  - ask Pierre for a generic custom item type.
- Changed-files tree filtering. Today we filter `visibleRenderableFiles` before virtualization. With CodeView, controlled `items` can still do this, but we need to preserve scroll/focus behavior.
- Comment drafting. Current drafting state is keyed by our file keys and line handlers. We need to map `CodeViewItem.id` to the same key and update `useDiffCommentDrafting` integration.
- Measurement assumptions. CodeView has `itemMetrics`; we need to set these from our actual row/header CSS or we may get jumpy scroll.
- Backend streaming. CodeView can add/update items imperatively, but our desktop contract still returns one whole patch. True streaming needs a later backend/query contract change.

## Recommended next slice

Do not rewrite the production diff panel immediately.

Next slice should be a small hidden/prototype component:

1. Build `DiffPanelCodeViewSpike` next to the existing diff panel.
2. Feed it the existing parsed `FileDiffMetadata[]` as controlled `CodeView` items.
3. Port only:
   - custom header
   - annotations
   - gutter utility
   - collapsed state
   - split/unified option
4. Leave image previews out of the spike first.
5. Compare behavior against the current panel.

If that works, then migrate production in two commits:

1. text/code diffs to `CodeView`
2. image diff behavior

If image/custom rows are awkward, keep our current architecture and only adopt smaller Pierre 1.2 APIs where they help.
