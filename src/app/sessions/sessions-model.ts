import type { Project, Thread } from '../types'

const OLD_THREAD_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

export type PastSessionThread = Thread & {
  projectId: string
  worktreeLabel?: string | undefined
}

export type SessionBulkAction = 'delete' | 'assign-current' | 'unassign'

function getWorktreeProjects(project: Project, projects: readonly Project[]) {
  return projects.filter(
    (candidate) =>
      candidate.worktree?.isMain === false && candidate.worktree.rootProjectId === project.id,
  )
}

export function getPastSessionThreads(
  project: Project | null,
  projects: readonly Project[],
  nowMs = Date.now(),
) {
  if (!project) return []
  const cutoffMs = nowMs - OLD_THREAD_THRESHOLD_MS
  const threads: PastSessionThread[] = [
    ...project.threads.map((thread) => ({ ...thread, projectId: project.id })),
    ...getWorktreeProjects(project, projects).flatMap((worktreeProject) =>
      worktreeProject.threads.map((thread) => ({
        ...thread,
        projectId: worktreeProject.id,
        worktreeLabel: worktreeProject.worktree?.branchName ?? worktreeProject.name,
        branchName: thread.branchName ?? worktreeProject.worktree?.branchName ?? undefined,
      })),
    ),
  ]

  return threads
    .filter((thread) => {
      if (thread.pinned || thread.running || thread.unread) return false
      return (thread.lastModifiedMs ?? Number.MAX_SAFE_INTEGER) < cutoffMs
    })
    .sort((left, right) => (right.lastModifiedMs ?? 0) - (left.lastModifiedMs ?? 0))
}

export function filterPastSessionThreads(threads: readonly PastSessionThread[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return threads
  return threads.filter((thread) =>
    [thread.title, thread.summary ?? '', thread.branchName ?? '', thread.worktreeLabel ?? '']
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  )
}

export function getSessionAssignmentLabel(thread: PastSessionThread) {
  const branchLabel = thread.branchName ?? 'Unassigned'
  if (!thread.worktreeLabel) return branchLabel
  return thread.worktreeLabel === branchLabel
    ? `${branchLabel} worktree`
    : `${thread.worktreeLabel} · ${branchLabel}`
}

export function getSelectedSessionProjectIds(
  threads: readonly PastSessionThread[],
  threadIds: readonly string[],
) {
  const threadIdSet = new Set(threadIds)
  return [
    ...new Set(threads.flatMap((thread) => (threadIdSet.has(thread.id) ? [thread.projectId] : []))),
  ]
}
