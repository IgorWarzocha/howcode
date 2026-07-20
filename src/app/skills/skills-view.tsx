import { ArrowUpRight } from 'lucide-react'
import { DisclosureSection } from '../common/disclosure-section'
import { ViewHeader } from '../common/view-header'
import { ViewShell } from '../common/view-shell'
import { appToneDangerClass, appToneMutedClass, appTypeGroupTextClass } from '../ui/classes'
import { skillsViewShellClass } from '../ui/screen-classes'
import { cn } from '../utils/cn'
import { BrowseSkillsSection } from './components/browse-skills-section'
import { InstalledSkillsSection } from './components/installed-skills-section'
import { useSkillsController } from './hooks/useSkillsController'
import type { InstallScope, SkillsViewProps } from './types'
import { openExternalUrl } from './utils'

type SkillsScopeSwitcherProps = {
  value: InstallScope
  projectScopeAvailable: boolean
  counts: Record<InstallScope, number>
  onChange: (scope: InstallScope) => void
}

function SkillsScopeSwitcher({ value, counts, onChange }: SkillsScopeSwitcherProps) {
  const options: Array<{ value: InstallScope; label: string; disabled?: boolean }> = [
    { value: 'global', label: `Global ${counts.global}` },
    { value: 'project', label: `Project ${counts.project}` },
    { value: 'chat', label: `Chat ${counts.chat}` },
  ]

  return (
    <fieldset className="m-0 flex min-w-0 items-center gap-1 border-0 p-0">
      <legend className="sr-only">Skill install scope</legend>
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              `rounded-md px-2 py-0.5 ${appTypeGroupTextClass} ${appToneMutedClass} transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[color:var(--muted)]`,
              selected && 'bg-[color:var(--surface-hover)] text-[color:var(--text)]',
            )}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </fieldset>
  )
}

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
        onClick={() => void openExternalUrl('https://skills.sh')}
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
  onSetProjectScopeActive,
  onAction,
  onClose,
}: SkillsViewProps) {
  const controller = useSkillsController({
    projectPath,
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
          <SkillsScopeSwitcher
            value={controller.installScope}
            counts={{
              global: controller.globalSkillCount,
              project: controller.projectSkillCount,
              chat: controller.chatSkillCount,
            }}
            projectScopeAvailable={controller.projectScopeAvailable}
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
