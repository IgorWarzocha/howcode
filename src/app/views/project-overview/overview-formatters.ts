const tokenFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat('en')
const costFormatter = new Intl.NumberFormat('en', {
  currency: 'USD',
  maximumFractionDigits: 4,
  style: 'currency',
})

export function formatTokens(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return tokenFormatter.format(value)
}

export function formatExactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return numberFormatter.format(value)
}

export function formatCost(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return costFormatter.format(value)
}

export function formatAverageCost(total: number | null | undefined, count: number) {
  if (total === null || total === undefined || count <= 0) return '—'
  return formatCost(total / count)
}
