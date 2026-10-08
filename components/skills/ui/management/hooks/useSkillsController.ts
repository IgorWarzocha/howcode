import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { PiConfiguredSkill } from '../../../../../src/app/desktop/types'
import { usePiResourceInstallScope } from '../../../../../src/app/pi-resources/use-pi-resource-install-scope'
import { usePiResourcePendingActions } from '../../../../../src/app/pi-resources/use-pi-resource-pending-actions'
import { desktopQueryKeys } from '../../../../../src/app/query/desktop-query'
import { getConfiguredPiSkillsQuery, installPiSkillQuery, removePiSkillQuery } from '../../query'
import { getActionError, getInstalledSkillSlugs, isDesktopSkillsAvailable } from '../utils'

const EMPTY_CONFIGURED_SKILLS: [] = []

export function useSkillsController({
  directoryPath,
  onDirectoryTargetSelected,
  onSetDirectoryScopeActive,
}: {
  directoryPath: string | null
  onDirectoryTargetSelected?: (() => void) | undefined
  onSetDirectoryScopeActive: (active: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [installedOpen, setInstalledOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const desktopSkillsAvailable = isDesktopSkillsAvailable()
  const { installScope, normalizedDirectoryPath, setInstallScope } = usePiResourceInstallScope({
    directoryPath,
    onDirectoryTargetSelected,
    onSetDirectoryScopeActive,
  })
  const { finishPendingAction, hasPendingInstall, isPendingAction, startPendingAction } =
    usePiResourcePendingActions()

  const configuredSkillsQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiSkills(directoryPath, true),
    queryFn: () => getConfiguredPiSkillsQuery({ directoryPath, chat: true }),
    staleTime: 30_000,
    enabled: desktopSkillsAvailable,
  })

  const configuredSkills = configuredSkillsQuery.data ?? EMPTY_CONFIGURED_SKILLS
  const activeScope =
    installScope === 'chat' ? 'chat' : installScope === 'directory' ? 'directory' : 'user'
  const globalSkillCount = configuredSkills.filter((skill) => skill.scope === 'user').length
  const directorySkillCount = configuredSkills.filter((skill) => skill.scope === 'directory').length
  const chatSkillCount = configuredSkills.filter((skill) => skill.scope === 'chat').length
  const visibleConfiguredSkills = useMemo(
    () => configuredSkills.filter((skill) => skill.scope === activeScope),
    [activeScope, configuredSkills],
  )
  const installedSkillSlugs = useMemo(
    () => getInstalledSkillSlugs(visibleConfiguredSkills),
    [visibleConfiguredSkills],
  )
  const invalidateConfiguredSkillsCaches = (skills?: PiConfiguredSkill[]) => {
    if (skills) {
      queryClient.setQueryData(desktopQueryKeys.configuredPiSkills(directoryPath, true), skills)
    }

    void queryClient.invalidateQueries({
      queryKey: ['desktop', 'piSkills', 'configured'],
    })
  }

  const handleInstall = async (source: string) => {
    if (installScope === 'directory' && !normalizedDirectoryPath) {
      setActionError('Select a folder first.')
      return false
    }

    const normalizedSource = source.trim()
    const pendingAction = { kind: 'install' as const, source: normalizedSource }

    startPendingAction(pendingAction)
    setActionError(null)

    try {
      const result = await installPiSkillQuery({
        source: normalizedSource,
        local: installScope === 'directory' || installScope === 'chat',
        directoryPath: normalizedDirectoryPath,
        chat: installScope === 'chat',
      })

      if (installScope === 'chat' && result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills)
      } else {
        invalidateConfiguredSkillsCaches()
      }

      return true
    } catch (error) {
      setActionError(getActionError(error))
      return false
    } finally {
      finishPendingAction(pendingAction)
    }
  }

  const handleRemove = async (configuredSkill: PiConfiguredSkill) => {
    const pendingAction = { kind: 'remove' as const, source: configuredSkill.installedPath }

    startPendingAction(pendingAction)
    setActionError(null)

    try {
      const result = await removePiSkillQuery({
        installedPath: configuredSkill.installedPath,
        directoryPath,
        chat: configuredSkill.scope === 'chat',
      })

      if (configuredSkill.scope === 'chat' && result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills)
      } else {
        invalidateConfiguredSkillsCaches()
      }
    } catch (error) {
      setActionError(getActionError(error))
    } finally {
      finishPendingAction(pendingAction)
    }
  }

  return {
    actionError,
    desktopSkillsAvailable,
    globalSkillCount,
    chatSkillCount,
    handleInstall,
    handleRemove,
    hasPendingInstall,
    installScope,
    installedOpen,
    installedSkillSlugs,
    isPendingInstall: (source: string) => isPendingAction('install', source),
    isPendingRemove: (installedPath: string) => isPendingAction('remove', installedPath),
    directorySkillCount,
    setInstallScope,
    setInstalledOpen,
    visibleConfiguredSkills,
  }
}
