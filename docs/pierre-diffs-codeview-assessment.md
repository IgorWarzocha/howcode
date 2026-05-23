# Pierre/Diffs CodeView assessment

## State now

- Howcode now uses `@pierre/diffs@^1.2.2`.
- `bun run ai:check` passes after the package bump.
- We now render the main diff list through Pierre `CodeView`.
- Desktop still returns one full patch string.
- Renderer still parses with `parsePatchFiles(...)`, but the parse worker now posts parsed files in chunks.
- Diff rows are fed into `CodeView` through the imperative `addItems(...)` / `updateItem(...)` path.
- The old Howcode-owned outer `@tanstack/react-virtual` layer has been removed.

So the package is current and the renderer is on the `CodeView` path. We now have renderer-side streaming from worker chunks into CodeView. True git/process streaming still needs a backend/query contract change.

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

## Migration target we just did

Replaced this stack:

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

Changed-files tree stays outside CodeView for now.

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

## What is now migrated

- `CodeView` owns the diff scroll/virtualization layer.
- We use `initialItems` and sync changes imperatively.
- Appending worker chunks goes through `CodeViewHandle.addItems(...)`.
- Existing rows update through `CodeViewHandle.updateItem(...)`.
- Reorders/filter changes fall back to `CodeView#setItems(...)`.
- Parsed file ordering is done before chunks are emitted, so streamed appends keep stable file order.

## Next slice

The production diff list is now on `CodeView`, and renderer-side streaming is in place. Next thing to assess is true git/process streaming:

1. Change the desktop diff contract so it can publish patch/file chunks instead of one whole patch string.
2. Decide whether parsing stays renderer-side or moves closer to the git stream.
3. Keep current full-patch path as fallback until streaming is proven.

Image previews still need visual verification because they are rendered through the custom header path.
