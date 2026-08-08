import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { PiConfiguredSkill } from '../../desktop/types'
import { usePiResourceInstallScope } from '../../pi-resources/use-pi-resource-install-scope'
import { usePiResourcePendingActions } from '../../pi-resources/use-pi-resource-pending-actions'
import {
  desktopQueryKeys,
  getConfiguredPiSkillsQuery,
  installPiSkillQuery,
  removePiSkillQuery,
} from '../../query/desktop-query'
import { getActionError, getInstalledSkillSlugs, isDesktopSkillsAvailable } from '../utils'

const EMPTY_CONFIGURED_SKILLS: [] = []

export function useSkillsController({
  projectPath,
  onProjectTargetSelected,
  onSetProjectScopeActive,
}: {
  projectPath: string | null
  onProjectTargetSelected?: (() => void) | undefined
  onSetProjectScopeActive: (active: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [installedOpen, setInstalledOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const desktopSkillsAvailable = isDesktopSkillsAvailable()
  const { installScope, normalizedProjectPath, setInstallScope } = usePiResourceInstallScope({
    projectPath,
    onProjectTargetSelected,
    onSetProjectScopeActive,
  })
  const { finishPendingAction, hasPendingInstall, isPendingAction, startPendingAction } =
    usePiResourcePendingActions()

  const configuredSkillsQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiSkills(projectPath, true),
    queryFn: () => getConfiguredPiSkillsQuery({ projectPath, chat: true }),
    staleTime: 30_000,
    enabled: desktopSkillsAvailable,
  })

  const configuredSkills = configuredSkillsQuery.data ?? EMPTY_CONFIGURED_SKILLS
  const activeScope =
    installScope === 'chat' ? 'chat' : installScope === 'project' ? 'project' : 'user'
  const globalSkillCount = configuredSkills.filter((skill) => skill.scope === 'user').length
  const projectSkillCount = configuredSkills.filter((skill) => skill.scope === 'project').length
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
      queryClient.setQueryData(desktopQueryKeys.configuredPiSkills(projectPath, true), skills)
    }

    void queryClient.invalidateQueries({
      queryKey: ['desktop', 'piSkills', 'configured'],
    })
  }

  const handleInstall = async (source: string) => {
    if (installScope === 'project' && !normalizedProjectPath) {
      setActionError('Select a project first.')
      return false
    }

    const normalizedSource = source.trim()
    const pendingAction = { kind: 'install' as const, source: normalizedSource }

    startPendingAction(pendingAction)
    setActionError(null)

    try {
      const result = await installPiSkillQuery({
        source: normalizedSource,
        local: installScope === 'project' || installScope === 'chat',
        projectPath: normalizedProjectPath,
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
        projectPath,
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
    projectSkillCount,
    setInstallScope,
    setInstalledOpen,
    visibleConfiguredSkills,
  }
}
