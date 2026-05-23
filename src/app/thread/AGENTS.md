# Thread module guidance

- Thread owns timeline layout, folded rows, message grouping, find-in-thread, and tool-call ledger presentation.
- Keep generic message rendering in `@howcode/common` when it is reused outside the timeline.
- Preserve message/tool semantics while changing presentation.
