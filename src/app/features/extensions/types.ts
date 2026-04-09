export type ExtensionsViewProps = {
  projectPath: string | null;
  onSetProjectScopeActive: (active: boolean) => void;
};

export type InstallScope = "global" | "project";

export type ManualSourceKind = "npm" | "git";

export type PendingAction = {
  kind: "install" | "remove";
  source: string;
};
