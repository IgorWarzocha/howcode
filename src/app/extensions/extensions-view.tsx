import { ArrowUpRight } from 'lucide-react'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import { openPiResourceUrl } from '../pi-resources/open-pi-resource-url'
import { PiResourceScopeSwitcher } from '../pi-resources/pi-resource-scope-switcher'
import { appToneDangerClass, appToneMutedClass, appTypeGroupTextClass } from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'
import { ActiveExtensionsSection } from './components/active-extensions-section'
import { InstallExtensionsSection } from './components/install-extensions-section'
import { SearchExtensionsSection } from './components/search-extensions-section'
import { useExtensionsController } from './hooks/useExtensionsController'
import type { ExtensionsViewProps } from './types'

function ExtensionsMetaLink() {
  return (
    <span
      className={cn(
        `${appTypeGroupTextClass} ${appToneMutedClass}`,
        'inline-flex items-center gap-1',
      )}
    >
      <span>via</span>
      <button
        type="button"
        className="group inline-flex items-center gap-0.5 p-0 text-inherit"
        onClick={() => void openPiResourceUrl('https://pi.dev/packages')}
        aria-label="Open pi.dev packages"
        data-tooltip="Open pi.dev packages"
      >
        <span className="transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
          pi.dev
        </span>
        <ArrowUpRight
          size={12}
          className="transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
        />
      </button>
    </span>
  )
}

function DesktopRequiredState({ onClose }: { onClose: () => void }) {
  return (
    <ViewShell className={`${skillsViewShellClass} gap-8`}>
      <ViewHeader
        title="Extensions"
        meta={<ExtensionsMetaLink />}
        onClose={onClose}
        closeLabel="Close extensions"
      />
      <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
        Desktop build required.
      </div>
    </ViewShell>
  )
}

export function ExtensionsView(props: ExtensionsViewProps) {
  const controller = useExtensionsController(props)

  if (!controller.desktopPackagesAvailable) {
    return <DesktopRequiredState onClose={props.onClose} />
  }

  return (
    <ViewShell className={skillsViewShellClass}>
      <ViewHeader
        title="Extensions"
        meta={<ExtensionsMetaLink />}
        onClose={props.onClose}
        closeLabel="Close extensions"
        actions={
          <PiResourceScopeSwitcher
            label="Extension"
            value={controller.installScope}
            counts={{
              global: controller.globalInstalledCount,
              project: controller.projectInstalledCount,
              chat: controller.chatInstalledCount,
            }}
            onChange={controller.setInstallScope}
          />
        }
      />

      <output className="sr-only" aria-live="polite">
        {controller.actionError ?? ''}
      </output>
      {controller.actionError ? (
        <div
          className={cn(
            `px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`,
            appToneDangerClass,
          )}
        >
          {controller.actionError}
        </div>
      ) : null}

      <InstallExtensionsSection
        installScope={controller.installScope}
        projectScopeAvailable={controller.projectScopeAvailable}
        hasPendingInstall={controller.hasPendingInstall}
        isInstallPending={controller.isInstallPending}
        onInstall={controller.handleInstall}
      />

      <ActiveExtensionsSection
        open={controller.installedOpen}
        entries={controller.scopedInstalledEntries}
        onToggleOpen={() => controller.setInstalledOpen((current) => !current)}
        onRemove={controller.handleRemove}
        isRemovePending={controller.isRemovePending}
      />

      <SearchExtensionsSection
        installScope={controller.installScope}
        projectScopeAvailable={controller.projectScopeAvailable}
        hasPendingInstall={controller.hasPendingInstall}
        installedIdentityKeys={controller.installedIdentityKeys}
        onInstall={controller.handleInstall}
        isInstallPending={controller.isInstallPending}
      />
    </ViewShell>
  )
}
