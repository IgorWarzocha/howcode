import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { PiConfiguredSkill } from "../../../desktop/types";
import {
  desktopQueryKeys,
  getConfiguredPiSkillsQuery,
  installPiSkillQuery,
  removePiSkillQuery,
} from "../../../query/desktop-query";
import type { InstallScope, PendingAction } from "../types";
import {
  getActionError,
  getInstalledSkillSlugs,
  isDesktopSkillsAvailable,
  isSkillCreatorCandidate,
} from "../utils";

export function useSkillsController({
  projectPath,
  onSetProjectScopeActive,
}: {
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const normalizedProjectPath = projectPath?.trim() ? projectPath : null;
  const [installScope, setInstallScope] = useState<InstallScope>("global");
  const [installedOpen, setInstalledOpen] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const desktopSkillsAvailable = isDesktopSkillsAvailable();
  const projectScopeAvailable = normalizedProjectPath !== null;

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
  const skillCreatorDetected = configuredSkills.some(
    (skill) =>
      isSkillCreatorCandidate(skill) && (skill.scope === "user" || installScope === "project"),
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
    if (!projectScopeAvailable && installScope === "project") {
      setInstallScope("global");
    }
  }, [installScope, projectScopeAvailable]);

  useEffect(() => {
    onSetProjectScopeActive(projectScopeAvailable && installScope === "project");

    return () => {
      onSetProjectScopeActive(false);
    };
  }, [installScope, onSetProjectScopeActive, projectScopeAvailable]);

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
    if (installScope === "project" && !normalizedProjectPath) {
      setActionError("Select a project first.");
      return false;
    }

    const normalizedSource = source.trim();
    const pendingAction = { kind: "install" as const, source: normalizedSource };

    addPendingAction(pendingAction);
    setActionError(null);

    try {
      const result = await installPiSkillQuery({
        source: normalizedSource,
        local: installScope === "project",
        projectPath: normalizedProjectPath,
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

  return {
    actionError,
    configuredSkillsQuery,
    desktopSkillsAvailable,
    globalSkillCount,
    handleInstall,
    handleRemove,
    hasPendingInstall: pendingActions.some((action) => action.kind === "install"),
    installScope,
    installedOpen,
    installedSkillSlugs,
    invalidateConfiguredSkillsCaches,
    isPendingInstall: (source: string) => isPending("install", source),
    isPendingRemove: (installedPath: string) => isPending("remove", installedPath),
    projectScopeAvailable,
    projectSkillCount,
    setActionError,
    setInstallScope,
    setInstalledOpen,
    skillCreatorDetected,
    visibleConfiguredSkills,
  };
}
