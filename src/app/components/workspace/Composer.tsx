import { useEffect, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionResult,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { SurfacePanel } from "../common/SurfacePanel";
import { ComposerBanner } from "./composer/ComposerBanner";
import { ComposerGitOpsMockSurface } from "./composer/ComposerGitOpsMockSurface";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";

export type ComposerProps = {
  activeView: View;
  hostLabel: string;
  model: ComposerModel | null;
  availableModels: ComposerModel[];
  thinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  projectGitState: ProjectGitState | null;
  sessionPath: string | null;
  onSetDiffPanelVisible: (visible: boolean) => void;
  onOpenTakeoverTerminal: () => void;
  onToggleTerminal: () => void;
  terminalVisible: boolean;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export function Composer(props: ComposerProps) {
  const [surface, setSurface] = useState<"prompt" | "git-ops">("prompt");

  useEffect(() => {
    props.onSetDiffPanelVisible(surface === "git-ops");
  }, [props.onSetDiffPanelVisible, surface]);

  return (
    <>
      {props.activeView === "home" ? <ComposerBanner onAction={props.onAction} /> : null}

      <SurfacePanel
        className="grid gap-0 overflow-hidden border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
        aria-label="Composer panel"
      >
        {surface === "git-ops" ? (
          <ComposerGitOpsMockSurface
            projectGitState={props.projectGitState}
            onAction={props.onAction}
            onBack={() => setSurface("prompt")}
          />
        ) : (
          <ComposerPromptSurface {...props} onOpenGitOps={() => setSurface("git-ops")} />
        )}
      </SurfacePanel>
    </>
  );
}
