import { ArrowUpRight } from "lucide-react";
import { DisclosureSection } from "../../components/common/DisclosureSection";
import { EmptyStateCard } from "../../components/common/EmptyStateCard";
import { SegmentedToggle } from "../../components/common/SegmentedToggle";
import { ViewHeader } from "../../components/common/ViewHeader";
import { ViewShell } from "../../components/common/ViewShell";
import { BrowseSkillsSection } from "./components/BrowseSkillsSection";
import { InstalledSkillsSection } from "./components/InstalledSkillsSection";
import { SkillCreatorSection } from "./components/SkillCreatorSection";
import { useSkillsController } from "./hooks/useSkillsController";
import type { SkillsViewProps } from "./types";
import { openExternalUrl } from "./utils";

function SkillsMetaLink() {
  return (
    <>
      <span className="text-[12px] text-[color:var(--muted)]">via</span>
      <button
        type="button"
        className="group inline-flex items-center gap-0.5 p-0 text-[12px]"
        onClick={() => void openExternalUrl("https://skills.sh")}
        aria-label="Open skills.sh"
        data-tooltip="Open skills.sh"
      >
        <span className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
          skills.sh
        </span>
        <ArrowUpRight
          size={12}
          className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
        />
      </button>
    </>
  );
}

function DesktopRequiredState({ onClose }: { onClose: () => void }) {
  return (
    <ViewShell className="gap-8">
      <ViewHeader
        title="Skills"
        meta={<SkillsMetaLink />}
        onClose={onClose}
        closeLabel="Close skills"
      />
      <EmptyStateCard>Desktop build required.</EmptyStateCard>
    </ViewShell>
  );
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
  });

  if (!controller.desktopSkillsAvailable) {
    return <DesktopRequiredState onClose={onClose} />;
  }

  return (
    <ViewShell>
      <ViewHeader
        title="Skills"
        meta={<SkillsMetaLink />}
        onClose={onClose}
        closeLabel="Close skills"
        actions={
          <SegmentedToggle
            size="compact"
            ariaLabel="Skill install scope"
            value={controller.installScope}
            options={[
              { value: "global", label: `Global (${controller.globalSkillCount})` },
              {
                value: "project",
                label: `Project (${controller.projectSkillCount})`,
                disabled: !controller.projectScopeAvailable,
              },
            ]}
            onChange={controller.setInstallScope}
          />
        }
      />

      {!controller.projectScopeAvailable ? (
        <div className="text-[12px] text-[color:var(--muted)]">
          Project skills are unavailable until a project path is available.
        </div>
      ) : null}

      <output className="sr-only" aria-live="polite">
        {controller.actionError ?? ""}
      </output>
      {controller.actionError ? (
        <div className="text-[12px] text-[#f2a7a7]">{controller.actionError}</div>
      ) : null}

      <SkillCreatorSection
        installScope={controller.installScope}
        projectPath={projectPath}
        skillCreatorDetected={controller.skillCreatorDetected}
        onRefreshSkillCreatorDetection={() => controller.configuredSkillsQuery.refetch()}
        onInvalidateConfiguredSkillsCaches={() => controller.invalidateConfiguredSkillsCaches()}
        onSetActionError={controller.setActionError}
      />

      <DisclosureSection
        title="Installed"
        open={controller.installedOpen}
        onToggle={() => controller.setInstalledOpen((current) => !current)}
      >
        {controller.installedOpen ? (
          <InstalledSkillsSection
            installScope={controller.installScope}
            skills={controller.visibleConfiguredSkills}
            isPendingRemove={controller.isPendingRemove}
            onRemove={controller.handleRemove}
          />
        ) : null}
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
  );
}
