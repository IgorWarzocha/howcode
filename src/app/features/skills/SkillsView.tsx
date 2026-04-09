import { ArrowUpRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";
import { BrowseSkillsSection } from "./components/BrowseSkillsSection";
import { InstalledSkillsSection } from "./components/InstalledSkillsSection";
import { SkillCreatorSection } from "./components/SkillCreatorSection";
import { useSkillsController } from "./hooks/useSkillsController";
import type { SkillsViewProps } from "./types";
import { openExternalUrl } from "./utils";

function SkillsHeader({
  globalSkillCount,
  installScope,
  projectSkillCount,
  onScopeChange,
}: {
  globalSkillCount: number;
  installScope: "global" | "project";
  projectSkillCount: number;
  onScopeChange: (scope: "global" | "project") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
        <span className="text-[12px] text-[color:var(--muted)]">via</span>
        <button
          type="button"
          className="group inline-flex items-center gap-0.5 p-0 text-[12px]"
          onClick={() => void openExternalUrl("https://skills.sh")}
          aria-label="Open skills.sh"
        >
          <span className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
            skills.sh
          </span>
          <ArrowUpRight
            size={12}
            className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
          />
        </button>
      </div>
      <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-1">
        {(["global", "project"] as const).map((scope) => (
          <button
            key={scope}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-[12px] capitalize transition-colors",
              installScope === scope
                ? "bg-[rgba(255,255,255,0.18)] font-medium text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.5)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--text)]",
            )}
            onClick={() => onScopeChange(scope)}
            aria-pressed={installScope === scope}
          >
            {scope === "global" ? `Global (${globalSkillCount})` : `Project (${projectSkillCount})`}
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopRequiredState() {
  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-8 px-2 pt-6 pb-6">
      <div className="flex items-center gap-1.5">
        <h1 className="m-0 text-[18px] font-medium text-[color:var(--text)]">Skills</h1>
        <span className="text-[12px] text-[color:var(--muted)]">via</span>
        <button
          type="button"
          className="group inline-flex items-center gap-0.5 p-0 text-[12px]"
          onClick={() => void openExternalUrl("https://skills.sh")}
          aria-label="Open skills.sh"
        >
          <span className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]">
            skills.sh
          </span>
          <ArrowUpRight
            size={12}
            className="text-[color:var(--muted)] transition-colors duration-150 ease-out group-hover:text-[color:var(--accent)]"
          />
        </button>
      </div>
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        Desktop build required.
      </div>
    </div>
  );
}

export function SkillsView({
  appSettings,
  projectPath,
  onSetProjectScopeActive,
  onAction,
}: SkillsViewProps) {
  const controller = useSkillsController({
    projectPath,
    onSetProjectScopeActive,
  });

  if (!controller.desktopSkillsAvailable) {
    return <DesktopRequiredState />;
  }

  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
      <SkillsHeader
        globalSkillCount={controller.globalSkillCount}
        installScope={controller.installScope}
        projectSkillCount={controller.projectSkillCount}
        onScopeChange={controller.setInstallScope}
      />

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

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => controller.setInstalledOpen((current) => !current)}
          aria-expanded={controller.installedOpen}
        >
          {controller.installedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Installed</span>
        </button>

        {controller.installedOpen ? (
          <InstalledSkillsSection
            installScope={controller.installScope}
            skills={controller.visibleConfiguredSkills}
            isPendingRemove={controller.isPendingRemove}
            onRemove={controller.handleRemove}
          />
        ) : null}
      </div>

      <BrowseSkillsSection
        appSettings={appSettings}
        installedSkillSlugs={controller.installedSkillSlugs}
        onAction={onAction}
        onInstall={controller.handleInstall}
        isPendingInstall={controller.isPendingInstall}
        hasPendingInstall={controller.hasPendingInstall}
      />
    </div>
  );
}
