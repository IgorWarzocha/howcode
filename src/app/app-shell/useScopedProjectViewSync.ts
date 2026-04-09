import { useEffect } from "react";
import type { View } from "../types";
import { shouldResetProjectScope } from "./scoped-project-view";

export function useScopedProjectViewSync({
  activeView,
  extensionsProjectScopeActive,
  setExtensionsProjectScopeActive,
  setSkillsProjectScopeActive,
  skillsProjectScopeActive,
}: {
  activeView: View;
  extensionsProjectScopeActive: boolean;
  setExtensionsProjectScopeActive: (active: boolean) => void;
  setSkillsProjectScopeActive: (active: boolean) => void;
  skillsProjectScopeActive: boolean;
}) {
  useEffect(() => {
    if (extensionsProjectScopeActive && shouldResetProjectScope(activeView, "extensions")) {
      setExtensionsProjectScopeActive(false);
    }

    if (skillsProjectScopeActive && shouldResetProjectScope(activeView, "skills")) {
      setSkillsProjectScopeActive(false);
    }
  }, [
    activeView,
    extensionsProjectScopeActive,
    setExtensionsProjectScopeActive,
    setSkillsProjectScopeActive,
    skillsProjectScopeActive,
  ]);
}
