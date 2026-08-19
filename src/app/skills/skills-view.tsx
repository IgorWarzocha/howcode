import { ArrowUpRight } from 'lucide-react'
import { DisclosureSection } from '../common/disclosure-section'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import { openPiResourceUrl } from '../pi-resources/open-pi-resource-url'
import { PiResourceScopeSwitcher } from '../pi-resources/pi-resource-scope-switcher'
import { appToneDangerClass, appToneMutedClass, appTypeGroupTextClass } from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'
import { BrowseSkillsSection } from './components/browse-skills-section'
import { InstalledSkillsSection } from './components/installed-skills-section'
import { useSkillsController } from './hooks/useSkillsController'
import type { SkillsViewProps } from './types'

function SkillsMetaLink() {
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
        onClick={() => void openPiResourceUrl('https://skills.sh')}
        aria-label="Open skills.sh"
        data-tooltip="Open skills.sh"
      >
        <span className="transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
          skills.sh
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
        title="Skills"
        meta={<SkillsMetaLink />}
        onClose={onClose}
        closeLabel="Close skills"
      />
      <div className={`px-2 py-1.5 ${appTypeGroupTextClass} ${appToneMutedClass}`}>
        Desktop build required.
      </div>
    </ViewShell>
  )
}

export function SkillsView({
  appSettings,
  projectPath,
  onProjectTargetSelected,
  onSetProjectScopeActive,
  onAction,
  onClose,
}: SkillsViewProps) {
  const controller = useSkillsController({
    projectPath,
    onProjectTargetSelected,
    onSetProjectScopeActive,
  })

  if (!controller.desktopSkillsAvailable) {
    return <DesktopRequiredState onClose={onClose} />
  }

  return (
    <ViewShell className={skillsViewShellClass}>
      <ViewHeader
        title="Skills"
        meta={<SkillsMetaLink />}
        onClose={onClose}
        closeLabel="Close skills"
        actions={
          <PiResourceScopeSwitcher
            label="Skill"
            value={controller.installScope}
            counts={{
              global: controller.globalSkillCount,
              project: controller.projectSkillCount,
              chat: controller.chatSkillCount,
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

      <DisclosureSection
        title="Installed"
        open={controller.installedOpen}
        onToggle={() => controller.setInstalledOpen((current) => !current)}
        forceMountContent
        chevronPosition="right"
      >
        <InstalledSkillsSection
          installScope={controller.installScope}
          expanded={controller.installedOpen}
          skills={controller.visibleConfiguredSkills}
          isPendingRemove={controller.isPendingRemove}
          onRemove={controller.handleRemove}
        />
      </DisclosureSection>

      <BrowseSkillsSection
        appSettings={appSettings}
        installedSkillSlugs={controller.installedSkillSlugs}
        onAction={onAction}
        onInstall={controller.handleInstall}
        isPendingInstall={controller.isPendingInstall}
        hasPendingInstall={controller.hasPendingInstall}
      />
    </ViewShell>
  )
}
