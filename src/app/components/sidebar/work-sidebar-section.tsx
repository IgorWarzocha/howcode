import { IconButton } from '@howcode/common/icon-button'
import { Tooltip } from '@howcode/common/tooltip'
import { Archive, Bot, ChevronDown, FolderCode, GitBranch, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DesktopActionInvoker, ProjectGitState } from '../../desktop/types'
import type { Project, Thread, View } from '../../types'
import { appToneSubtleClass, appTypeMetaClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import { ThreadRow } from './project-tree/thread-row'
import { SidebarProjectsSkeleton } from './sidebar-skeletons'

const ACTIVE_THREAD_LIMIT = 5

type WorkSidebarSectionProps = {
  activeView: View
  loading: boolean
  projects: Project[]
  projectGitState: ProjectGitState | null
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningProjectIds: ReadonlySet<string>
  terminalRunningSessionPaths: ReadonlySet<string>
  onAction: DesktopActionInvoker
  onLoadProjectThreads: (projectId: string, options?: { chat?: boolean }) => Promise<unknown>
  onOpenArchivedThreads: () => void
  onProjectSelect: (projectId: string) => void
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
  onShowView: (view: Exclude<View, 'gitops'>) => void
}

type ThreadBuckets = {
  activeThreads: Thread[]
  olderThreads: Thread[]
}

function getThreadSortValue(thread: Thread) {
  return thread.lastModifiedMs ?? 0
}

function bucketThreads(project: Project, selectedThreadId: string | null): ThreadBuckets {
  const sortedThreads = [...project.threads].sort(
    (a, b) => getThreadSortValue(b) - getThreadSortValue(a),
  )
  const activeThreads: Thread[] = []
  const olderThreads: Thread[] = []

  for (const thread of sortedThreads) {
    const shouldKeepVisible =
      thread.id === selectedThreadId ||
      Boolean(thread.pinned) ||
      Boolean(thread.running) ||
      Boolean(thread.unread) ||
      activeThreads.length < ACTIVE_THREAD_LIMIT

    if (shouldKeepVisible) {
      activeThreads.push(thread)
    } else {
      olderThreads.push(thread)
    }
  }

  return { activeThreads, olderThreads }
}

function ProjectOptionRow({
  active,
  project,
  running,
  onSelect,
}: {
  active: boolean
  project: Project
  running: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="sidebar-work-project-option"
      data-active={active ? 'true' : 'false'}
      onClick={onSelect}
    >
      <FolderCode size={13} />
      <span className="truncate">{project.name}</span>
      {running ? (
        <span className="sidebar-work-live-dot" title="Running terminal" aria-hidden="true" />
      ) : null}
    </button>
  )
}

function WorkThreadRow({
  activeView,
  project,
  selectedThreadId,
  terminalRunningSessionPaths,
  thread,
  currentBranch,
  onAction,
  onThreadOpen,
}: {
  activeView: View
  project: Project
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  thread: Thread
  currentBranch: string | null
  onAction: DesktopActionInvoker
  onThreadOpen: (projectId: string, threadId: string, sessionPath: string) => void
}) {
  const isSelected =
    selectedThreadId === thread.id &&
    (activeView === 'thread' || activeView === 'project' || activeView === 'gitops')

  return (
    <ThreadRow
      age={thread.age}
      pinned={Boolean(thread.pinned)}
      running={Boolean(thread.running)}
      terminalRunning={Boolean(
        thread.sessionPath && terminalRunningSessionPaths.has(thread.sessionPath),
      )}
      unread={Boolean(thread.unread)}
      isSelected={isSelected}
      title={thread.title}
      branchName={thread.branchName}
      branchAssignedToCurrent={Boolean(currentBranch && thread.branchName === currentBranch)}
      assignBranchLabel={currentBranch ? `Assign to ${currentBranch}` : 'Clear assigned branch'}
      onArchive={() =>
        onAction('thread.archive', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
      onAssignToBranch={() =>
        onAction('thread.assign-branch', {
          projectId: project.id,
          threadId: thread.id,
          branchName: currentBranch,
        })
      }
      onOpen={() => {
        if (!thread.sessionPath) return
        onThreadOpen(project.id, thread.id, thread.sessionPath)
      }}
      onPin={() =>
        onAction('thread.pin', {
          projectId: project.id,
          threadId: thread.id,
        })
      }
    />
  )
}

export function WorkSidebarSection({
  activeView,
  loading,
  projects,
  projectGitState,
  selectedProjectId,
  selectedThreadId,
  terminalRunningProjectIds,
  terminalRunningSessionPaths,
  onAction,
  onLoadProjectThreads,
  onOpenArchivedThreads,
  onProjectSelect,
  onThreadOpen,
  onShowView,
}: WorkSidebarSectionProps) {
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null
  const { activeThreads, olderThreads } = useMemo(
    () =>
      selectedProject
        ? bucketThreads(selectedProject, selectedThreadId)
        : { activeThreads: [], olderThreads: [] },
    [selectedProject, selectedThreadId],
  )

  useEffect(() => {
    if (!selectedProject || selectedProject.threadsLoaded) return
    void onLoadProjectThreads(selectedProject.id, { chat: false })
  }, [onLoadProjectThreads, selectedProject])

  if (loading && projects.length === 0) return <SidebarProjectsSkeleton />

  if (!selectedProject) {
    return (
      <section className="sidebar-work-section" aria-label="Work">
        <div className="sidebar-work-empty">
          <FolderCode size={18} />
          <span>No projects yet</span>
        </div>
      </section>
    )
  }

  const threadCount = selectedProject.threadCount ?? selectedProject.threads.length
  const currentBranch =
    projectGitState?.projectId === selectedProject.id && projectGitState.isGitRepo
      ? projectGitState.branch
      : null
  const workLabel = currentBranch ?? selectedProject.name

  return (
    <section className="sidebar-work-section" aria-label="Project work">
      <div className="sidebar-work-project-card">
        <div className="sidebar-work-project-kicker">Project</div>
        <button
          type="button"
          className="sidebar-work-project-button"
          onClick={() => setProjectSwitcherOpen((open) => !open)}
          aria-expanded={projectSwitcherOpen}
        >
          <span className="truncate">{selectedProject.name}</span>
          <ChevronDown size={14} />
        </button>
        {projectSwitcherOpen ? (
          <div className="sidebar-work-project-list">
            {projects.map((project) => (
              <ProjectOptionRow
                key={project.id}
                project={project}
                active={project.id === selectedProject.id}
                running={terminalRunningProjectIds.has(project.id)}
                onSelect={() => {
                  onProjectSelect(project.id)
                  void onAction('project.select', { projectId: project.id })
                  setProjectSwitcherOpen(false)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="sidebar-work-actions">
        <button
          type="button"
          className="sidebar-work-action-row"
          data-active={activeView === 'automations' ? 'true' : 'false'}
          onClick={() => onShowView('automations')}
        >
          <Bot size={15} />
          <span>Automations</span>
          <span className="sidebar-work-pill">Soon</span>
        </button>
      </div>

      <div className="sidebar-work-lane">
        <div className="sidebar-work-section-heading">
          <div>
            <div className="sidebar-work-project-kicker">Threads</div>
            <div className="sidebar-work-lane-title">
              <GitBranch size={13} />
              <span className="truncate">{workLabel}</span>
            </div>
          </div>
          <Tooltip content="New thread" placement="right">
            <IconButton
              label="New thread"
              icon={<Plus size={14} />}
              className="h-7 w-7 rounded-lg"
              onClick={() =>
                onAction('thread.new', {
                  projectId: selectedProject.id,
                  composerMode: 'code',
                })
              }
            />
          </Tooltip>
        </div>

        <div className="sidebar-work-thread-list">
          {activeThreads.length > 0 ? (
            activeThreads.map((thread) => (
              <WorkThreadRow
                key={thread.id}
                activeView={activeView}
                project={selectedProject}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                thread={thread}
                onAction={onAction}
                onThreadOpen={onThreadOpen}
                currentBranch={currentBranch}
              />
            ))
          ) : (
            <div className="sidebar-work-start-card">
              <span>No active threads for this work context.</span>
              <button
                type="button"
                onClick={() =>
                  onAction('thread.new', {
                    projectId: selectedProject.id,
                    composerMode: 'code',
                  })
                }
              >
                Start one
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-work-history">
        <button type="button" className="sidebar-work-history-row" onClick={onOpenArchivedThreads}>
          <Archive size={14} />
          <span>Older threads</span>
          <span className={cn(appTypeMetaClass, appToneSubtleClass)}>
            {olderThreads.length > 0 ? olderThreads.length : threadCount}
          </span>
        </button>
        <button type="button" className="sidebar-work-history-row" onClick={onOpenArchivedThreads}>
          <Search size={14} />
          <span>Search history</span>
        </button>
      </div>
    </section>
  )
}
