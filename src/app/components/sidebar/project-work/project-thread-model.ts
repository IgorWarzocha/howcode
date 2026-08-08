import type { Project, Thread } from '../../../types'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export type ThreadBuckets = {
  activeThreads: Thread[]
  olderThreads: Thread[]
}

export type SidebarThread = Thread & {
  sidebarWorktreePath?: string | undefined
  sidebarWorktreeLabel?: string | undefined
}

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

export function sortThreads(threads: Thread[]) {
  return threads.toSorted((a, b) => getThreadSortValue(b) - getThreadSortValue(a))
}

export function bucketThreads(project: Project, selectedThreadId: string | null): ThreadBuckets {
  const sortedThreads = sortThreads(project.threads)
  const cutoffMs = Date.now() - OLD_THREAD_THRESHOLD_MS
  const activeThreads: Thread[] = []
  const olderThreads: Thread[] = []

  for (const thread of sortedThreads) {
    const shouldKeepVisible =
      thread.id === selectedThreadId ||
      Boolean(thread.pinned) ||
      Boolean(thread.running) ||
      Boolean(thread.unread) ||
      (thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) >= cutoffMs

    if (shouldKeepVisible) {
      activeThreads.push(thread)
    } else {
      olderThreads.push(thread)
    }
  }

  return { activeThreads, olderThreads }
}

export function getWorktreeProjectsForRoot(project: Project, projects: readonly Project[]) {
  return projects.filter(
    (candidate) =>
      candidate.id !== project.id &&
      candidate.worktree?.rootProjectId === project.id &&
      candidate.worktree.isMain === false,
  )
}

export function getThreadBucketsForProjectWork(
  project: Project,
  projects: readonly Project[],
  selectedThreadId: string | null,
) {
  const rootBuckets = bucketThreads(project, selectedThreadId)
  const worktreeBuckets = getWorktreeProjectsForRoot(project, projects).reduce(
    (buckets, worktreeProject) => {
      const nextBuckets = bucketThreads(worktreeProject, selectedThreadId)
      const annotateThread = (thread: Thread): SidebarThread => ({
        ...thread,
        sidebarWorktreePath: worktreeProject.id,
        sidebarWorktreeLabel: worktreeProject.worktree?.branchName ?? worktreeProject.name,
        branchName: worktreeProject.worktree?.branchName ?? thread.branchName ?? undefined,
      })
      buckets.activeThreads.push(...nextBuckets.activeThreads.map(annotateThread))
      buckets.olderThreads.push(...nextBuckets.olderThreads.map(annotateThread))
      return buckets
    },
    { activeThreads: [...rootBuckets.activeThreads], olderThreads: [...rootBuckets.olderThreads] },
  )
  return {
    activeThreads: sortThreads(worktreeBuckets.activeThreads),
    olderThreads: sortThreads(worktreeBuckets.olderThreads),
  }
}

export function filterThreadsForCurrentBranch(
  threads: readonly Thread[],
  currentBranch: string | null,
) {
  if (!currentBranch) return []
  return sortThreads(threads.filter((thread) => thread.branchName === currentBranch))
}

export function filterThreadsBySearch(threads: readonly Thread[], searchQuery: string) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  if (!normalizedSearchQuery) return [...threads]
  return threads.filter((thread) =>
    [thread.title, thread.summary ?? '', thread.branchName ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchQuery),
  )
}
