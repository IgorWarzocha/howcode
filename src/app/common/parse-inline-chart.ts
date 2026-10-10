type Chart = { type: 'bar' | 'line'; title: string; data: { label: string; value: number }[] }

export function parseInlineChart(source: string): Chart | null {
  if (source.length > 20_000) return null
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || !('type' in value) || !('data' in value)) return null
  if (value.type !== 'bar' && value.type !== 'line') return null
  if (!Array.isArray(value.data) || value.data.length === 0 || value.data.length > 40) return null
  const data: Chart['data'] = []
  const labels = new Set<string>()
  for (const row of value.data) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.label !== 'string' ||
      !row.label.trim() ||
      labels.has(row.label) ||
      row.label.length > 120 ||
      typeof row.value !== 'number' ||
      !Number.isFinite(row.value) ||
      Math.abs(row.value) > 1e12
    )
      return null
    data.push({ label: row.label, value: row.value })
    labels.add(row.label)
  }
  const title =
    'title' in value && typeof value.title === 'string' ? value.title.slice(0, 200) : 'Chart'
  return { type: value.type, title, data }
}
