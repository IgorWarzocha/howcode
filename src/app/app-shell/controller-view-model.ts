import type { ThreadData } from '../desktop/types'
import type { WorkspaceState } from '../state/workspace'
import { getCurrentTitle, getProjectName, selectProject, selectThread } from '../state/workspace'
import type { Project, Thread } from '../types'

const pathSeparatorPattern = /[\\/]/

type DeriveControllerViewModelInput = {
  projects: Project[]
  workspaceState: WorkspaceState
  threadData: ThreadData | null
  shellCwd: string | null | undefined
  composerState: import('../desktop/types').ComposerState | null
  shellComposerState: import('../desktop/types').ComposerState | null | undefined
}

type ControllerViewModel = {
  collapsedProjectIds: Record<string, boolean>
  selectedProject: Project | undefined
  selectedThread: Thread | undefined
  activeThreadData: ThreadData | null
  currentTitle: string
  currentProjectName: string
  composerProjectId: string
  activeComposerState: import('../desktop/types').ComposerState | null
}

function buildFallbackThreadData(
  sessionPath: string,
  selectedThread: Thread | undefined,
): ThreadData {
  return {
    sessionPath,
    title: selectedThread?.title ?? 'New thread',
    messages: [],
    previousMessageCount: 0,
    isStreaming: false,
    isCompacting: false,
  }
}

function getSelectedProjectName(project: Project | undefined, selectedProjectId: string) {
  if (project) return getProjectName(project)
  const pathParts = selectedProjectId.split(pathSeparatorPattern).filter(Boolean)
  return pathParts.at(-1) ?? getProjectName(undefined)
}

function getComposerProjectId(input: {
  selectedProject: Project | undefined
  selectedProjectId: string
  hasSelectedProject: boolean
  shellCwd: string | null | undefined
}) {
  if (input.selectedProject) return input.selectedProject.id
  if (input.hasSelectedProject && input.selectedProjectId) return input.selectedProjectId
  return input.shellCwd ?? ''
}

export function deriveControllerViewModel({
  projects,
  workspaceState,
  threadData,
  shellCwd,
  composerState,
  shellComposerState,
}: DeriveControllerViewModelInput): ControllerViewModel {
  const collapsedProjectIds = Object.fromEntries(
    projects.map((project) => [
      project.id,
      workspaceState.collapsedProjectIds[project.id] ?? project.collapsed ?? true,
    ]),
  )
  const selectedProject = selectProject(projects, workspaceState.selectedProjectId)
  const selectedThread = selectThread(selectedProject, workspaceState.selectedThreadId)
  const activeThreadData = workspaceState.selectedSessionPath
    ? (threadData ?? buildFallbackThreadData(workspaceState.selectedSessionPath, selectedThread))
    : null

  return {
    collapsedProjectIds,
    selectedProject,
    selectedThread,
    activeThreadData,
    currentTitle:
      workspaceState.activeView === 'chat' || workspaceState.activeView === 'thread'
        ? (activeThreadData?.title ?? selectedThread?.title ?? 'New thread')
        : getCurrentTitle(workspaceState.activeView, selectedThread),
    currentProjectName: getSelectedProjectName(selectedProject, workspaceState.selectedProjectId),
    // Keep sidebar selection strict, but never let composer/runtime actions fall back
    // to the app shell cwd while the user has a selected project. The project list can
    // be briefly stale around project creation/new-thread transitions; the workspace
    // selection is still the intended runtime cwd.
    composerProjectId: getComposerProjectId({
      selectedProject,
      selectedProjectId: workspaceState.selectedProjectId,
      hasSelectedProject: workspaceState.hasSelectedProject,
      shellCwd,
    }),
    activeComposerState: composerState ?? shellComposerState ?? null,
  }
}
