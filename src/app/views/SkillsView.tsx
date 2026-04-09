import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AppSettings, DesktopActionResult, PiConfiguredSkill } from "../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiSkillsQuery,
  installPiSkillQuery,
  removePiSkillQuery,
} from "../query/desktop-query";
import { cn } from "../utils/cn";
import { BrowseSkillsSection } from "./skills/BrowseSkillsSection";
import { InstalledSkillsSection } from "./skills/InstalledSkillsSection";
import { SkillCreatorSection } from "./skills/SkillCreatorSection";
import {
  getActionError,
  getInstalledSkillSlugs,
  isDesktopSkillsAvailable,
  isSkillCreatorCandidate,
  openExternalUrl,
} from "./skills/helpers";

type SkillsViewProps = {
  appSettings: AppSettings;
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
  onAction: (
    action: "settings.update",
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

type PendingAction = {
  kind: "install" | "remove";
  source: string;
};

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
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
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
  const queryClient = useQueryClient();
  const [installScope, setInstallScope] = useState<"global" | "project">("global");
  const [installedOpen, setInstalledOpen] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const desktopSkillsAvailable = isDesktopSkillsAvailable();

  const configuredSkillsQuery = useQuery({
    queryKey: desktopQueryKeys.configuredPiSkills(projectPath),
    queryFn: () => getConfiguredPiSkillsQuery({ projectPath }),
    staleTime: 30_000,
    enabled: desktopSkillsAvailable,
  });

  const configuredSkills = configuredSkillsQuery.data ?? [];
  const activeScope = installScope === "project" ? "project" : "user";
  const globalSkillCount = configuredSkills.filter((skill) => skill.scope === "user").length;
  const projectSkillCount = configuredSkills.filter((skill) => skill.scope === "project").length;
  const hasGlobalSkillCreator = configuredSkills.some(
    (skill) => skill.scope === "user" && isSkillCreatorCandidate(skill),
  );
  const visibleConfiguredSkills = useMemo(
    () => configuredSkills.filter((skill) => skill.scope === activeScope),
    [activeScope, configuredSkills],
  );
  const installedSkillSlugs = useMemo(
    () => getInstalledSkillSlugs(visibleConfiguredSkills),
    [visibleConfiguredSkills],
  );

  useEffect(() => {
    onSetProjectScopeActive(installScope === "project");

    return () => {
      onSetProjectScopeActive(false);
    };
  }, [installScope, onSetProjectScopeActive]);

  const invalidateConfiguredSkillsCaches = (skills?: PiConfiguredSkill[]) => {
    if (skills) {
      queryClient.setQueryData(desktopQueryKeys.configuredPiSkills(projectPath), skills);
    }

    void queryClient.invalidateQueries({
      queryKey: ["desktop", "piSkills", "configured"],
    });
  };

  const addPendingAction = (action: PendingAction) => {
    setPendingActions((current) => [...current, action]);
  };

  const removePendingAction = (action: PendingAction) => {
    setPendingActions((current) =>
      current.filter(
        (currentAction) =>
          currentAction.kind !== action.kind || currentAction.source !== action.source,
      ),
    );
  };

  const isPending = (kind: PendingAction["kind"], source: string) => {
    const normalizedSource = source.trim().toLowerCase();
    return pendingActions.some(
      (action) => action.kind === kind && action.source.trim().toLowerCase() === normalizedSource,
    );
  };

  const handleInstall = async (source: string) => {
    const normalizedSource = source.trim();
    const pendingAction = { kind: "install" as const, source: normalizedSource };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiSkillQuery({
        source: normalizedSource,
        local: installScope === "project",
        projectPath,
      });

      if (result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills);
      }

      return true;
    } catch (error) {
      setActionError(getActionError(error));
      return false;
    } finally {
      removePendingAction(pendingAction);
    }
  };

  const handleRemove = async (configuredSkill: PiConfiguredSkill) => {
    const pendingAction = { kind: "remove" as const, source: configuredSkill.installedPath };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await removePiSkillQuery({
        installedPath: configuredSkill.installedPath,
        projectPath,
      });

      if (result?.configuredSkills) {
        invalidateConfiguredSkillsCaches(result.configuredSkills);
      }
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      removePendingAction(pendingAction);
    }
  };

  if (!desktopSkillsAvailable) {
    return <DesktopRequiredState />;
  }

  return (
    <div className="mx-auto grid h-full w-full max-w-[860px] content-start gap-4 px-2 pt-6 pb-6">
      <SkillsHeader
        globalSkillCount={globalSkillCount}
        installScope={installScope}
        projectSkillCount={projectSkillCount}
        onScopeChange={setInstallScope}
      />

      {actionError ? <div className="text-[12px] text-[#f2a7a7]">{actionError}</div> : null}

      <SkillCreatorSection
        installScope={installScope}
        projectPath={projectPath}
        skillCreatorDetected={hasGlobalSkillCreator}
        onRefreshSkillCreatorDetection={() => configuredSkillsQuery.refetch()}
        onInvalidateConfiguredSkillsCaches={() => invalidateConfiguredSkillsCaches()}
        onSetActionError={setActionError}
      />

      <div className="grid gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
          onClick={() => setInstalledOpen((current) => !current)}
          aria-expanded={installedOpen}
        >
          {installedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Installed</span>
        </button>

        {installedOpen ? (
          <InstalledSkillsSection
            installScope={installScope}
            skills={visibleConfiguredSkills}
            isPendingRemove={(installedPath) => isPending("remove", installedPath)}
            onRemove={handleRemove}
          />
        ) : null}
      </div>

      <BrowseSkillsSection
        appSettings={appSettings}
        installedSkillSlugs={installedSkillSlugs}
        onAction={onAction}
        onInstall={handleInstall}
        isPendingInstall={(source) => isPending("install", source)}
        hasPendingInstall={pendingActions.some((action) => action.kind === "install")}
      />
    </div>
  );
}
