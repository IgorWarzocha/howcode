import type { DesktopRequestMap } from '@howcode/shared/desktop-ipc'
import type { DirectoryUsageSummary } from '../../../src/app/desktop/types'
export async function getDirectoryUsageSummaryQuery(
  directoryId: string,
): Promise<DirectoryUsageSummary | null> {
  return (await window.piDesktop?.getDirectoryUsageSummary?.(directoryId)) ?? null
}

export async function getDirectoryFaviconQuery(directoryId: string): Promise<string | null> {
  return (await window.piDesktop?.getDirectoryFavicon?.(directoryId)) ?? null
}

export async function listDirectoryDirectoryEntriesQuery(
  request: DesktopRequestMap['listDirectoryDirectoryEntries']['params'] = {},
): Promise<DesktopRequestMap['listDirectoryDirectoryEntries']['response'] | null> {
  return (await window.piDesktop?.listDirectoryDirectoryEntries?.(request)) ?? null
}
