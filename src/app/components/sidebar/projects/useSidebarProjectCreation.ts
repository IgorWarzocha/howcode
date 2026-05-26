import type { SettingsOpenTarget } from '@howcode/settings/settingsTypes'
import { parseGitHubRepositoryUrl } from '@howcode/shared/github-repository-url'
import { useState } from 'react'
import type { AppSettings, DesktopActionInvoker } from '../../../desktop/types'
import { getSidebarFolderProjectName } from './sidebar-projects-folder-browser'

export type PendingProject = {
  key: string
  name: string
}

function restoreCreateProjectDraft(input: {
  draft: string
  setCreateOpen: (open: boolean) => void
  setPendingProject: (project: PendingProject | null) => void
  setProjectNameDraft: (draft: string) => void
}) {
  input.setProjectNameDraft(input.draft)
  input.setCreateOpen(true)
  input.setPendingProject(null)
}

function recordCreatedProject(input: {
  result: Awaited<ReturnType<DesktopActionInvoker>>
  setCreatedProjectIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const projectId =
    typeof input.result?.result?.projectId === 'string' ? input.result.result.projectId : null
  if (projectId)
    input.setCreatedProjectIds((current) => [
      projectId,
      ...current.filter((id) => id !== projectId),
    ])
}

function prepareCreateProject(input: {
  appSettings: AppSettings
  createBusy: boolean
  parentPath?: string | null | undefined
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  projectNameDraft: string
  setCreateErrorMessage: (message: string | null) => void
  setCreateOpen: (open: boolean) => void
}) {
  if (input.createBusy) return null
  input.setCreateErrorMessage(null)
  if (!(input.parentPath || input.appSettings.preferredProjectLocation)) {
    input.setCreateOpen(false)
    input.onOpenSettingsPanel({ category: 'howcode', settingId: 'projects.default-location' })
    return null
  }
  const draft = input.projectNameDraft.trim()
  return draft || null
}

const pathLikeProjectDraftPattern = /^(~(?:[/\\]|$)|[/\\]|[A-Za-z]:[/\\])/

function isPathLikeProjectDraft(draft: string) {
  return pathLikeProjectDraftPattern.test(draft.trim())
}

function getCreateProjectPayload(draft: string, parentPath?: string | null) {
  const repository = parseGitHubRepositoryUrl(draft)
  if (isPathLikeProjectDraft(draft) && !repository) {
    return {
      pendingProjectName: getSidebarFolderProjectName(draft),
      payload: { projectPath: draft, createIfMissing: true },
    }
  }

  return {
    pendingProjectName: repository?.folderName ?? draft,
    payload: repository
      ? { repoUrl: repository.canonicalUrl, parentPath: parentPath ?? undefined }
      : { projectName: draft, parentPath: parentPath ?? undefined },
  }
}

export function useSidebarProjectCreation({
  appSettings,
  onAction,
  onOpenSettingsPanel,
}: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null)
  const [createdProjectIds, setCreatedProjectIds] = useState<string[]>([])
  const [pendingProject, setPendingProject] = useState<PendingProject | null>(null)

  const handleCreateProject = async (options?: { parentPath?: string | null }) => {
    const draft = prepareCreateProject({
      appSettings,
      createBusy,
      parentPath: options?.parentPath,
      onOpenSettingsPanel,
      projectNameDraft,
      setCreateErrorMessage,
      setCreateOpen,
    })
    if (!draft) return

    const { payload, pendingProjectName } = getCreateProjectPayload(draft, options?.parentPath)
    setPendingProject({ key: `${Date.now()}:${draft}`, name: pendingProjectName })
    setProjectNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('project.add', payload)
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        restoreCreateProjectDraft({ draft, setCreateOpen, setPendingProject, setProjectNameDraft })
        return
      }

      recordCreatedProject({ result, setCreatedProjectIds })
      setPendingProject(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add project.')
      restoreCreateProjectDraft({ draft, setCreateOpen, setPendingProject, setProjectNameDraft })
    } finally {
      setCreateBusy(false)
    }
  }

  const handleAddFolderProject = async (projectPath: string, options?: { create?: boolean }) => {
    if (createBusy) return
    const pendingProjectName = getSidebarFolderProjectName(projectPath)
    setCreateErrorMessage(null)
    setPendingProject({ key: `${Date.now()}:${projectPath}`, name: pendingProjectName })
    setProjectNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('project.add', {
        projectPath,
        createIfMissing: options?.create === true,
      })
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        setCreateOpen(true)
        setPendingProject(null)
        return
      }

      recordCreatedProject({ result, setCreatedProjectIds })
      setPendingProject(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add project.')
      setCreateOpen(true)
      setPendingProject(null)
    } finally {
      setCreateBusy(false)
    }
  }

  return {
    createBusy,
    createErrorMessage,
    createdProjectIds,
    createOpen,
    handleAddFolderProject,
    handleCreateProject,
    pendingProject,
    projectNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setProjectNameDraft,
  }
}
