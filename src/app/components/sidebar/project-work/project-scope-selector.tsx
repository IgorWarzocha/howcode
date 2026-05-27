import { IconButton } from '@howcode/common/icon-button'
import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../../desktop/types'
import { useDismissibleLayer } from '../../../hooks/useDismissibleLayer'
import type { Project } from '../../../types'
import { SidebarProjectsCreatePopover } from '../projects/sidebar-projects-create-popover'
import { useSidebarProjectCreation } from '../projects/useSidebarProjectCreation'
import { ProjectBrandIcon } from './project-brand-icon'

function ProjectScopeOptionRow({
  focused,
  project,
  running,
  visible,
  onToggleVisible,
}: {
  focused: boolean
  project: Project
  running: boolean
  visible: boolean
  onToggleVisible: () => void
}) {
  return (
    <div
      className="sidebar-compact-row sidebar-compact-row--project-option sidebar-project-work-project-option"
      data-active={focused ? 'true' : 'false'}
    >
      <button
        type="button"
        className="sidebar-project-work-project-scope-toggle"
        data-checked={visible ? 'true' : 'false'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleVisible()
        }}
        aria-label={visible ? `Hide ${project.name} in sidebar` : `Show ${project.name} in sidebar`}
      >
        {visible ? <Check size={11} /> : null}
      </button>
      <button
        type="button"
        className="sidebar-project-work-project-focus"
        onClick={onToggleVisible}
      >
        <ProjectBrandIcon project={project} />
        <span className="truncate">{project.name}</span>
      </button>
      {running ? (
        <span
          className="sidebar-project-work-live-dot"
          title="Running terminal"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

export function ProjectScopeSelector({
  appSettings,
  label,
  open,
  projects,
  scopeProject,
  selectedProject,
  terminalRunningWorkspaceIds,
  visibleProjects,
  onAction,
  onOpenChange,
  onOpenSettingsPanel,
  onToggleVisibleProject,
}: {
  appSettings: AppSettings
  label: string
  open: boolean
  projects: Project[]
  scopeProject: Project | null
  selectedProject: Project | null
  terminalRunningWorkspaceIds: ReadonlySet<string>
  visibleProjects: Project[]
  onAction: DesktopActionInvoker
  onOpenChange: (open: boolean) => void
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  onToggleVisibleProject: (projectId: string) => void
}) {
  const selectorRef = useRef<HTMLDivElement | null>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const createPanelRef = useRef<HTMLDialogElement>(null)
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const {
    createBusy,
    createErrorMessage,
    createOpen,
    handleAddFolderProject,
    handleCreateProject,
    projectNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setProjectNameDraft,
  } = useSidebarProjectCreation({ appSettings, onAction, onOpenSettingsPanel })
  const normalizedProjectSearch = projectSearchQuery.trim().toLowerCase()
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => project.id)),
    [visibleProjects],
  )
  const filteredProjects = useMemo(() => {
    if (!normalizedProjectSearch) return projects
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(normalizedProjectSearch) ||
        project.id.toLowerCase().includes(normalizedProjectSearch),
    )
  }, [normalizedProjectSearch, projects])

  const closeCreatePopover = () => {
    setCreateOpen(false)
    setCreateErrorMessage(null)
  }
  const dismissSelector = () => {
    closeCreatePopover()
    onOpenChange(false)
  }
  useDismissibleLayer({
    open: open || createOpen,
    onDismiss: dismissSelector,
    refs: [selectorRef, createPanelRef],
    shouldDismissOnEscape: (event) => {
      if (projectSearchQuery.length === 0) return true
      const target = event.target as HTMLElement | null
      if (!target?.closest('.sidebar-project-work-project-search-field')) return true
      event.preventDefault()
      event.stopImmediatePropagation()
      setProjectSearchQuery('')
      return false
    },
  })

  return (
    <div ref={selectorRef} className="sidebar-project-work-project-card">
      <div className="sidebar-project-work-project-header-row">
        <div className="sidebar-project-work-project-kicker">Projects</div>
        <IconButton
          ref={createButtonRef}
          label="Add project"
          icon={<Plus size={13} />}
          tooltipPlacement="right"
          className="sidebar-project-work-project-create-button h-7 w-7 -translate-x-px rounded-md"
          onClick={() => {
            if (open) onOpenChange(false)
            setCreateOpen(!createOpen)
          }}
        />
      </div>
      <button
        type="button"
        className="sidebar-project-work-project-button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <span className="sidebar-project-work-project-button-meta">
          {scopeProject ? <ProjectBrandIcon project={scopeProject} /> : null}
          <ChevronDown size={13} />
        </span>
      </button>
      {open ? (
        <div className="sidebar-project-work-project-list">
          <label
            className="sidebar-search-field sidebar-project-work-project-search-field"
            data-active={projectSearchQuery.trim().length > 0 ? 'true' : 'false'}
          >
            <Search size={14} className="sidebar-search-icon" />
            <input
              value={projectSearchQuery}
              onChange={(event) => setProjectSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || projectSearchQuery.length === 0) return
                event.stopPropagation()
                setProjectSearchQuery('')
              }}
              placeholder="Search projects"
              className="sidebar-search-input"
              aria-label="Search projects"
            />
          </label>
          {filteredProjects.map((project) => (
            <ProjectScopeOptionRow
              key={project.id}
              project={project}
              focused={project.id === selectedProject?.id}
              visible={visibleProjectIds.has(project.id)}
              running={terminalRunningWorkspaceIds.has(project.id)}
              onToggleVisible={() => onToggleVisibleProject(project.id)}
            />
          ))}
          {filteredProjects.length === 0 ? (
            <div className="sidebar-project-work-project-empty">No matching projects</div>
          ) : null}
        </div>
      ) : null}
      <SidebarProjectsCreatePopover
        menuId="sidebar-project-work-project-create"
        open={createOpen}
        variant="project-work"
        draft={projectNameDraft}
        defaultLocation={appSettings.preferredProjectLocation ?? null}
        busy={createBusy}
        errorMessage={createErrorMessage}
        panelRef={createPanelRef}
        onChangeDraft={setProjectNameDraft}
        onCreate={handleCreateProject}
        onAddFolder={handleAddFolderProject}
        onClose={closeCreatePopover}
      />
    </div>
  )
}
