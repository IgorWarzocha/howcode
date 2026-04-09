import type { AppSettings, DesktopActionResult } from "../../desktop/types";

export type SkillsViewProps = {
  appSettings: AppSettings;
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
  onAction: (
    action: "settings.update",
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export type InstallScope = "global" | "project";

export type PendingAction = {
  kind: "install" | "remove";
  source: string;
};
