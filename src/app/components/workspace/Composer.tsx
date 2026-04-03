import { useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type { ComposerAttachment, ComposerModel, ComposerThinkingLevel } from "../../desktop/types";
import type { View } from "../../types";
import { ComposerBanner } from "./composer/ComposerBanner";
import { ComposerGitOpsMockSurface } from "./composer/ComposerGitOpsMockSurface";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";
import type { GitOpsMockMode } from "./composer/git-ops-mock";

export type ComposerProps = {
  activeView: View;
  hostLabel: string;
  profileLabel: string;
  model: ComposerModel | null;
  availableModels: ComposerModel[];
  thinkingLevel: ComposerThinkingLevel;
  availableThinkingLevels: ComposerThinkingLevel[];
  projectId: string;
  sessionPath: string | null;
  onOpenDiffPanel: () => void;
  onOpenTakeoverTerminal: () => void;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => Promise<void>;
};

export function Composer(props: ComposerProps) {
  const [surface, setSurface] = useState<"prompt" | "git-ops">("prompt");
  const [gitOpsMockMode, setGitOpsMockMode] = useState<GitOpsMockMode>("dirty");

  return (
    <>
      {props.activeView === "home" ? <ComposerBanner onAction={props.onAction} /> : null}

      {surface === "git-ops" ? (
        <ComposerGitOpsMockSurface
          gitOpsMockMode={gitOpsMockMode}
          onAction={props.onAction}
          onBack={() => setSurface("prompt")}
          onOpenDiffPanel={props.onOpenDiffPanel}
          onSetGitOpsMockMode={setGitOpsMockMode}
        />
      ) : (
        <ComposerPromptSurface
          {...props}
          gitOpsMockMode={gitOpsMockMode}
          onOpenGitOps={() => setSurface("git-ops")}
        />
      )}
    </>
  );
}
