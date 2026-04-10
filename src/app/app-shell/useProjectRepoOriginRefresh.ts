import { useEffect, useRef } from "react";
import type { DesktopAction } from "../desktop/actions";
import type { AnyDesktopActionPayload, DesktopActionResult } from "../desktop/types";
import type { Project } from "../types";

export function useProjectRepoOriginRefresh({
  projects,
  selectedProjectId,
  runDesktopAction,
}: {
  projects: Project[];
  selectedProjectId: string;
  runDesktopAction: (
    action: DesktopAction,
    payload?: AnyDesktopActionPayload,
  ) => Promise<DesktopActionResult | null>;
}) {
  const inspectedProjectIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (!selectedProject || selectedProject.repoOriginChecked) {
      return;
    }

    if (inspectedProjectIdsRef.current.has(selectedProject.id)) {
      return;
    }

    inspectedProjectIdsRef.current.add(selectedProject.id);
    void runDesktopAction("project.refresh-repo-origin", { projectId: selectedProject.id });
  }, [projects, runDesktopAction, selectedProjectId]);
}
