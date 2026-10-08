import { useState } from 'react'
import { parseGitHubRepositoryUrl } from '../../../../../shared/github-repository-url'
import type { AppSettings, DesktopActionInvoker } from '../../../../../src/app/desktop/types'
import type { SettingsOpenTarget } from '../../../../../src/app/settings/settings/settingsTypes'
import { getSidebarFolderDirectoryName } from './sidebar-directory-name'

export type PendingDirectory = {
  key: string
  name: string
}

function restoreCreateDirectoryDraft(input: {
  draft: string
  setCreateOpen: (open: boolean) => void
  setPendingDirectory: (directory: PendingDirectory | null) => void
  setDirectoryNameDraft: (draft: string) => void
}) {
  input.setDirectoryNameDraft(input.draft)
  input.setCreateOpen(true)
  input.setPendingDirectory(null)
}

function recordCreatedDirectory(input: {
  result: Awaited<ReturnType<DesktopActionInvoker>>
  setCreatedDirectoryIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const directoryId =
    typeof input.result?.result?.directoryId === 'string' ? input.result.result.directoryId : null
  if (directoryId)
    input.setCreatedDirectoryIds((current) => [
      directoryId,
      ...current.filter((id) => id !== directoryId),
    ])
}

const pathLikeDirectoryDraftPattern = /^(~(?:[/\\]|$)|[/\\]|[A-Za-z]:[/\\])/

export function isPathLikeDirectoryDraft(draft: string) {
  return pathLikeDirectoryDraftPattern.test(draft.trim())
}

function prepareCreateDirectory(input: {
  appSettings: AppSettings
  createBusy: boolean
  parentPath?: string | null | undefined
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
  directoryNameDraft: string
  setCreateErrorMessage: (message: string | null) => void
  setCreateOpen: (open: boolean) => void
}) {
  if (input.createBusy) return null
  input.setCreateErrorMessage(null)
  const draft = input.directoryNameDraft.trim()
  if (!draft) return null
  const repository = parseGitHubRepositoryUrl(draft)
  if (
    !(
      input.parentPath ||
      input.appSettings.preferredDirectoryLocation ||
      (isPathLikeDirectoryDraft(draft) && !repository)
    )
  ) {
    input.setCreateOpen(false)
    input.onOpenSettingsPanel({ category: 'howcode', settingId: 'projects.default-location' })
    return null
  }
  return draft
}

function getCreateDirectoryPayload(draft: string, parentPath?: string | null) {
  const repository = parseGitHubRepositoryUrl(draft)
  if (isPathLikeDirectoryDraft(draft) && !repository) {
    return {
      pendingDirectoryName: getSidebarFolderDirectoryName(draft),
      payload: { directoryPath: draft, createIfMissing: true },
    }
  }

  return {
    pendingDirectoryName: repository?.folderName ?? draft,
    payload: repository
      ? { repoUrl: repository.canonicalUrl, parentPath: parentPath ?? undefined }
      : { directoryName: draft, parentPath: parentPath ?? undefined },
  }
}

export function useSidebarDirectoryCreation({
  appSettings,
  onAction,
  onOpenSettingsPanel,
}: {
  appSettings: AppSettings
  onAction: DesktopActionInvoker
  onOpenSettingsPanel: (target?: SettingsOpenTarget) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [directoryNameDraft, setDirectoryNameDraft] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null)
  const [createdDirectoryIds, setCreatedDirectoryIds] = useState<string[]>([])
  const [pendingDirectory, setPendingDirectory] = useState<PendingDirectory | null>(null)

  const handleCreateDirectory = async (options?: { parentPath?: string | null }) => {
    const draft = prepareCreateDirectory({
      appSettings,
      createBusy,
      parentPath: options?.parentPath,
      onOpenSettingsPanel,
      directoryNameDraft,
      setCreateErrorMessage,
      setCreateOpen,
    })
    if (!draft) return

    const { payload, pendingDirectoryName } = getCreateDirectoryPayload(draft, options?.parentPath)
    setPendingDirectory({ key: `${Date.now()}:${draft}`, name: pendingDirectoryName })
    setDirectoryNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('directory.add', payload)
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        restoreCreateDirectoryDraft({
          draft,
          setCreateOpen,
          setPendingDirectory,
          setDirectoryNameDraft,
        })
        return
      }

      recordCreatedDirectory({ result, setCreatedDirectoryIds })
      setPendingDirectory(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add workspace.')
      restoreCreateDirectoryDraft({
        draft,
        setCreateOpen,
        setPendingDirectory,
        setDirectoryNameDraft,
      })
    } finally {
      setCreateBusy(false)
    }
  }

  const handleAddFolderDirectory = async (
    directoryPath: string,
    options?: { create?: boolean },
  ) => {
    if (createBusy) return
    const pendingDirectoryName = getSidebarFolderDirectoryName(directoryPath)
    setCreateErrorMessage(null)
    setPendingDirectory({ key: `${Date.now()}:${directoryPath}`, name: pendingDirectoryName })
    setDirectoryNameDraft('')
    setCreateOpen(false)
    setCreateBusy(true)

    try {
      const result = await onAction('directory.add', {
        directoryPath,
        createIfMissing: options?.create === true,
      })
      const error = typeof result?.result?.error === 'string' ? result.result.error : null

      if (error) {
        setCreateErrorMessage(error)
        setCreateOpen(true)
        setPendingDirectory(null)
        return
      }

      recordCreatedDirectory({ result, setCreatedDirectoryIds })
      setPendingDirectory(null)
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : 'Unable to add workspace.')
      setCreateOpen(true)
      setPendingDirectory(null)
    } finally {
      setCreateBusy(false)
    }
  }

  return {
    createBusy,
    createErrorMessage,
    createdDirectoryIds,
    createOpen,
    handleAddFolderDirectory,
    handleCreateDirectory,
    pendingDirectory,
    directoryNameDraft,
    setCreateErrorMessage,
    setCreateOpen,
    setDirectoryNameDraft,
  }
}
