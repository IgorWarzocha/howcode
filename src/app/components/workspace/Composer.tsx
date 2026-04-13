import { useEffect, useRef, useState } from "react";
import type {
  ComposerAttachment,
  ComposerFilePickerState,
  ComposerModel,
  ComposerThinkingLevel,
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../desktop/types";
import type { View } from "../../types";
import { SurfacePanel } from "../common/SurfacePanel";
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
  diffBaseline: ProjectDiffBaseline;
  sessionPath: string | null;
  favoriteFolders: string[];
  onSetDiffPanelVisible: (visible: boolean) => void;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  promptResetKey: number;
  onOpenTakeoverTerminal: () => void;
  onToggleTerminal: () => void;
  terminalVisible: boolean;
  onLayoutChange: () => void;
  onPickAttachments: (projectId?: string | null) => Promise<ComposerAttachment[]>;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
  onAction: DesktopActionInvoker;
};

export function Composer(props: ComposerProps) {
  const [surface, setSurface] = useState<"prompt" | "git-ops">("prompt");
  const composerPanelRef = useRef<HTMLDivElement>(null);

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
    <SurfacePanel
      ref={composerPanelRef}
      className="grid gap-0 overflow-visible border-[rgba(169,178,215,0.06)] bg-[rgba(39,42,57,0.94)] shadow-none"
      aria-label="Composer panel"
    >
      {surface === "git-ops" ? (
        <ComposerGitOpsSurface
          composerPanelRef={composerPanelRef}
          projectGitState={props.projectGitState}
          diffBaseline={props.diffBaseline}
          diffRenderMode={props.diffRenderMode}
          diffComments={props.diffComments}
          diffCommentCount={props.diffCommentCount}
          diffCommentsSending={props.diffCommentsSending}
          diffCommentError={props.diffCommentError}
          onSetDiffBaseline={props.onSetDiffBaseline}
          onSetDiffRenderMode={props.onSetDiffRenderMode}
          onSendDiffComments={props.onSendDiffComments}
          onSelectDiffComment={props.onSelectDiffComment}
          onAction={props.onAction}
          onLayoutChange={props.onLayoutChange}
          onBack={() => setSurface("prompt")}
        />
      ) : (
        <ComposerPromptSurface
          {...props}
          composerPanelRef={composerPanelRef}
          onOpenGitOps={() => setSurface("git-ops")}
        />
      )}
    </SurfacePanel>
  );
}
