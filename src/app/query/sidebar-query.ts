import { getSidebarRepositorySnapshot } from '@howaboua/howcode-sdk/sidebar-renderer'
import type { DirectoryGitState } from '../desktop/types'

/** Sidebar owns repository inspection; the shell only routes its admitted public capability. */
export async function getSidebarRepositoryStateQuery(
  directoryId: string,
): Promise<DirectoryGitState | null> {
  return (await getSidebarRepositorySnapshot().getGitState?.(directoryId)) ?? null
}
