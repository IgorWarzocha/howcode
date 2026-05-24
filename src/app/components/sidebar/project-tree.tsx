import { useState } from 'react'
import type { DesktopActionInvoker } from '../../desktop/types'
import type { Project, View } from '../../types'
import { ProjectActionMenu } from './project-action-menu'
import { ProjectRow } from './project-tree/project-row'
import { ProjectThreadsList } from './project-tree/project-threads-list'
import { isProtectedProjectDeletionTarget } from './project-tree/project-tree-paths'
import { useProjectMenuDismiss } from './project-tree/useProjectMenuDismiss'

type ProjectTreeProps = {
  projects: Project[]
  protectedProjectId?: string | null
  selectedProjectId: string
  selectedThreadId: string | null
  terminalRunningSessionPaths: ReadonlySet<string>
  activeView: View
  selectionModeActive: boolean
  revealOldThreads?: boolean
  collapsedProjectIds: Record<string, boolean>
  onAction: DesktopActionInvoker
  onProjectSelect: (projectId: string) => void
  onProjectPrimeSelection: (projectId: string) => void
  onThreadOpen: (
    projectId: string,
    threadId: string,
    sessionPath: string,
    view?: 'chat' | 'thread' | undefined,
  ) => void
  onToggleProjectCollapse: (projectId: string) => void
}

export function ProjectTree({
  projects,
  protectedProjectId = null,
  selectedProjectId,
  selectedThreadId,
  terminalRunningSessionPaths,
  activeView,
  selectionModeActive,
  revealOldThreads = false,
  collapsedProjectIds,
  onAction,
  onProjectSelect,
  onProjectPrimeSelection,
  onThreadOpen,
  onToggleProjectCollapse,
}: ProjectTreeProps) {
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [expandedOldProjectIds, setExpandedOldProjectIds] = useState<Record<string, boolean>>({})
  const [renameDraft, setRenameDraft] = useState('')
  const { containerRef } = useProjectMenuDismiss(openProjectMenuId !== null, () =>
    setOpenProjectMenuId(null),
  )

  const handleStartEdit = (projectId: string, projectName: string) => {
    setOpenProjectMenuId(null)
    setEditingProjectId(projectId)
    setRenameDraft(projectName)
  }

  const handleCancelEdit = () => {
    setEditingProjectId(null)
    setRenameDraft('')
  }

  const handleSubmitEdit = (projectId: string) => {
    const nextProjectName = renameDraft.trim()
    if (!nextProjectName) {
      handleCancelEdit()
      return
    }

    void onAction('project.edit-name', {
      projectId,
      projectName: nextProjectName,
    })
    setEditingProjectId(null)
    setRenameDraft('')
  }

  return (
    <div ref={containerRef} className="sidebar-project-tree">
      {projects.map((project) => {
        const effectiveIsExpanded = !collapsedProjectIds[project.id]
        const projectMenuOpen = openProjectMenuId === project.id
        const threadGroupId = `project-threads-${project.id}`
        const actionMenuId = `project-actions-${project.id}`

        return (
          <div key={project.id} className="sidebar-tree-item">
            <div className="relative">
              <ProjectRow
                actionMenuId={actionMenuId}
                actionMenuOpen={projectMenuOpen}
                dragHandleProps={undefined}
                isActive={selectionModeActive && selectedProjectId === project.id}
                isDragging={false}
                isEditing={editingProjectId === project.id}
                isExpanded={effectiveIsExpanded}
                pinned={Boolean(project.pinned)}
                hasRepoOrigin={Boolean(project.repoOriginUrl)}
                canEdit={!selectionModeActive}
                canToggleExpanded={!selectionModeActive}
                name={project.name}
                renameDraft={renameDraft}
                showActions={!selectionModeActive}
                threadGroupId={threadGroupId}
                onCancelEdit={handleCancelEdit}
                onChangeRenameDraft={setRenameDraft}
                onEdit={() => handleStartEdit(project.id, project.name)}
                onSelect={() => {
                  onProjectSelect(project.id)
                  if (activeView !== 'extensions' && activeView !== 'skills') {
                    void onAction('project.select', { projectId: project.id })
                  }
                  setOpenProjectMenuId(null)
                }}
                onSubmitEdit={() => handleSubmitEdit(project.id)}
                onCreateSession={() => {
                  if (activeView === 'chat') {
                    void onAction('thread.new', { projectId: project.id })
                  } else if (activeView === 'extensions' || activeView === 'skills') {
                    onProjectPrimeSelection(project.id)
                  } else {
                    onProjectSelect(project.id)
                    void onAction('thread.new', {
                      projectId: project.id,
                      composerMode: 'code',
                    })
                  }
                  setOpenProjectMenuId(null)
                }}
                onToggleActions={() =>
                  setOpenProjectMenuId((current) => (current === project.id ? null : project.id))
                }
                onToggleExpanded={() => onToggleProjectCollapse(project.id)}
              />
              {projectMenuOpen && editingProjectId !== project.id && !selectionModeActive ? (
                <ProjectActionMenu
                  menuId={actionMenuId}
                  canDelete={
                    !isProtectedProjectDeletionTarget(
                      project.resolvedId ?? project.id,
                      protectedProjectId,
                    )
                  }
                  projectId={project.id}
                  projectName={project.name}
                  pinned={Boolean(project.pinned)}
                  onAction={onAction}
                  onClose={() => setOpenProjectMenuId(null)}
                />
              ) : null}
            </div>

            {selectionModeActive ? null : (
              <ProjectThreadsList
                activeView={activeView}
                expandedByUser={expandedOldProjectIds[project.id] === true}
                isExpanded={effectiveIsExpanded}
                project={project}
                revealOldThreads={revealOldThreads}
                selectedThreadId={selectedThreadId}
                terminalRunningSessionPaths={terminalRunningSessionPaths}
                threadGroupId={threadGroupId}
                onAction={onAction}
                onCloseProjectMenu={() => setOpenProjectMenuId(null)}
                onThreadOpen={onThreadOpen}
                onToggleOldThreads={(currentlyExpanded) =>
                  setExpandedOldProjectIds((current) => ({
                    ...current,
                    [project.id]: !currentlyExpanded,
                  }))
                }
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
