import type { TimelineRow } from './timeline-row'

export function getTimelineRowMessageIds(row: TimelineRow) {
  if (row.kind === 'message') return [row.message.id]
  if (row.kind === 'tool-group') return row.messages.map((message) => message.id)
  if (row.kind === 'summary') return [row.message.id]
  if (row.kind !== 'turn') return []
  return [
    row.userMessage?.id,
    ...row.items.flatMap((item) =>
      item.kind === 'message' ? [item.message.id] : item.messages.map((message) => message.id),
    ),
  ].filter((id): id is string => Boolean(id))
}

export function buildTimelineRowByMessageId(rows: TimelineRow[]) {
  return new Map(
    rows.flatMap((row) => getTimelineRowMessageIds(row).map((id) => [id, row] as const)),
  )
}
