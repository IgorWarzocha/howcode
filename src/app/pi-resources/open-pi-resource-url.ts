import { getSafeExternalUrl } from '@howcode/shared/external-url'
import { openExternalQuery } from '../query/desktop-query'

export async function openPiResourceUrl(url: string) {
  const safeUrl = getSafeExternalUrl(url)
  if (!safeUrl) return false
  if (await openExternalQuery(safeUrl)) return true

  window.open(safeUrl, '_blank', 'noopener,noreferrer')
  return true
}
