import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { PiConfiguredPackage } from '../../desktop/types'
import { usePiResourceInstallScope } from '../../pi-resources/use-pi-resource-install-scope'
import { usePiResourcePendingActions } from '../../pi-resources/use-pi-resource-pending-actions'
import {
  desktopQueryKeys,
  getConfiguredPiPackagesQuery,
  installPiPackageQuery,
  removePiPackageQuery,
} from '../../query/desktop-query'
import type { ExtensionsViewProps, ManualSourceKind } from '../types'
import { getActionError, getInstalledIdentityKeys, isDesktopPackagesAvailable } from '../utils'

const EMPTY_CONFIGURED_PACKAGES: [] = []

export function useExtensionsController({
  projectPath,
  onProjectTargetSelected,
  onSetProjectScopeActive,
}: ExtensionsViewProps) {
  const queryClient = useQueryClient()
  const [installedOpen, setInstalledOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const desktopPackagesAvailable = isDesktopPackagesAvailable()
  const { installScope, normalizedProjectPath, projectScopeAvailable, setInstallScope } =
    usePiResourceInstallScope({
      projectPath,
      onProjectTargetSelected,
      onSetProjectScopeActive,
    })
  const { finishPendingAction, hasPendingInstall, isPendingAction, startPendingAction } =
    usePiResourcePendingActions()

  const configuredPackagesQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiPackages(projectPath, true),
    queryFn: () => getConfiguredPiPackagesQuery({ projectPath, chat: true }),
    staleTime: 30_000,
    enabled: desktopPackagesAvailable,
  })

  const configuredPackages = configuredPackagesQuery.data ?? EMPTY_CONFIGURED_PACKAGES
  const installedEntries = useMemo(
    () =>
      configuredPackages.filter(
        (configuredPackage) => typeof configuredPackage.installedPath === 'string',
      ),
    [configuredPackages],
  )
  const globalInstalledCount = installedEntries.filter(
    (configuredPackage) => configuredPackage.scope === 'user',
  ).length
  const projectInstalledCount = installedEntries.filter(
    (configuredPackage) => configuredPackage.scope === 'project',
  ).length
  const chatInstalledCount = installedEntries.filter(
    (configuredPackage) => configuredPackage.scope === 'chat',
  ).length
  const scopedInstalledEntries = useMemo(
    () =>
      installedEntries.filter((configuredPackage) =>
        installScope === 'chat'
          ? configuredPackage.scope === 'chat'
          : installScope === 'project'
            ? configuredPackage.scope === 'project'
            : configuredPackage.scope === 'user',
      ),
    [installScope, installedEntries],
  )
  const installedIdentityKeys = useMemo(
    () => getInstalledIdentityKeys(scopedInstalledEntries),
    [scopedInstalledEntries],
  )
  const updateConfiguredPackagesCache = (packages?: PiConfiguredPackage[]) => {
    if (packages) {
      queryClient.setQueryData(desktopQueryKeys.configuredPiPackages(projectPath, true), packages)
    }

    void queryClient.invalidateQueries({
      queryKey: ['desktop', 'piPackages', 'configured'],
    })
  }

  const handleInstall = async (source: string, kind: ManualSourceKind) => {
    if (installScope === 'project' && !normalizedProjectPath) {
      setActionError('Select a project first.')
      return false
    }

    const normalizedSource = source.trim()
    const pendingAction = { kind: 'install' as const, source: normalizedSource }

    startPendingAction(pendingAction)
    setActionError(null)

    try {
      const result = await installPiPackageQuery({
        source: normalizedSource,
        kind,
        local: installScope === 'project' || installScope === 'chat',
        projectPath: normalizedProjectPath,
        chat: installScope === 'chat',
      })

      if (installScope === 'chat' && result?.configuredPackages) {
        updateConfiguredPackagesCache(result.configuredPackages)
      } else {
        updateConfiguredPackagesCache()
      }

      return true
    } catch (error) {
      setActionError(getActionError(error))
      return false
    } finally {
      finishPendingAction(pendingAction)
    }
  }

  const handleRemove = async (configuredPackage: PiConfiguredPackage) => {
    const pendingAction = { kind: 'remove' as const, source: configuredPackage.source }

    startPendingAction(pendingAction)
    setActionError(null)

    try {
      const result = await removePiPackageQuery({
        source: configuredPackage.source,
        local: configuredPackage.scope === 'project' || configuredPackage.scope === 'chat',
        projectPath: normalizedProjectPath,
        chat: configuredPackage.scope === 'chat',
      })

      if (configuredPackage.scope === 'chat' && result?.configuredPackages) {
        updateConfiguredPackagesCache(result.configuredPackages)
      } else {
        updateConfiguredPackagesCache()
      }
    } catch (error) {
      setActionError(getActionError(error))
    } finally {
      finishPendingAction(pendingAction)
    }
  }

  return {
    actionError,
    chatInstalledCount,
    desktopPackagesAvailable,
    globalInstalledCount,
    hasPendingInstall,
    installScope,
    installedIdentityKeys,
    installedOpen,
    isInstallPending: (source: string) => isPendingAction('install', source),
    isRemovePending: (source: string) => isPendingAction('remove', source),
    projectScopeAvailable,
    projectInstalledCount,
    scopedInstalledEntries,
    setInstallScope,
    setInstalledOpen,
    handleInstall,
    handleRemove,
  }
}
