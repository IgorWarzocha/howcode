import { useEffect, useState } from "react";
import type { DesktopAction } from "../../desktop/actions";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionResult,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { SurfacePanel } from "../common/SurfacePanel";
import { ComposerBanner } from "./composer/ComposerBanner";
import { ComposerGitOpsSurface } from "./composer/ComposerGitOpsSurface";
import { ComposerPromptSurface } from "./composer/ComposerPromptSurface";
import type { SavedDiffComment } from "./diff/diffCommentStore";

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
  favoriteFolders: string[];
  onSetDiffPanelVisible: (visible: boolean) => void;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  promptResetKey: number;
  onOpenTakeoverTerminal: () => void;
  onToggleTerminal: () => void;
  terminalVisible: boolean;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
};

export function Composer(props: ComposerProps) {
  const [surface, setSurface] = useState<"prompt" | "git-ops">("prompt");

  useEffect(() => {
    if (props.promptResetKey < 0) {
      return;
    }

    setSurface("prompt");
  }, [props.promptResetKey]);

  useEffect(() => {
    props.onSetDiffPanelVisible(surface === "git-ops");
  }, [props.onSetDiffPanelVisible, surface]);

  return (
    <>
      {props.activeView === "home" ? <ComposerBanner onAction={props.onAction} /> : null}

      <SurfacePanel
        className="grid gap-0 overflow-visible border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
        aria-label="Composer panel"
      >
        {surface === "git-ops" ? (
          <ComposerGitOpsSurface
            projectGitState={props.projectGitState}
            diffRenderMode={props.diffRenderMode}
            diffComments={props.diffComments}
            diffCommentCount={props.diffCommentCount}
            diffCommentsSending={props.diffCommentsSending}
            diffCommentError={props.diffCommentError}
            onSetDiffRenderMode={props.onSetDiffRenderMode}
            onSendDiffComments={props.onSendDiffComments}
            onSelectDiffComment={props.onSelectDiffComment}
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
