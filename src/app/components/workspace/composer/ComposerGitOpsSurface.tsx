import { useMemo } from "react";
import type { DesktopAction } from "../../../desktop/actions";
import type { DesktopActionResult, ProjectGitState } from "../../../desktop/types";
import { getFeatureStatusDataAttributes } from "../../../features/feature-status";
import { cn } from "../../../utils/cn";
import type { SavedDiffComment } from "../diff/diffCommentStore";
import { ComposerGitOpsFooter } from "./ComposerGitOpsFooter";
import { ComposerGitOpsMessageField } from "./ComposerGitOpsMessageField";
import { ComposerGitOpsTopBar } from "./ComposerGitOpsTopBar";
import { useComposerGitOpsState } from "./useComposerGitOpsState";

type ComposerGitOpsSurfaceProps = {
  projectGitState: ProjectGitState | null;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onLayoutChange: () => void;
  onBack: () => void;
};

export function ComposerGitOpsSurface({
  projectGitState,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  onSetDiffRenderMode,
  onSendDiffComments,
  onSelectDiffComment,
  onAction,
  onLayoutChange,
  onBack,
}: ComposerGitOpsSurfaceProps) {
  void diffCommentCount;

  const {
    actionErrorMessage,
    canCommit,
    commentCards,
    commitFocused,
    commitMessage,
    handleCommitMessageChange,
    handlePrimaryAction,
    handleSaveOrigin,
    hasDiffComments,
    hasOrigin,
    includeUnstaged,
    isGitHubOrigin,
    isGitRepo,
    previewEnabled,
    primaryActionLabel,
    pushEnabled,
    repoUrl,
    runningPrimaryAction,
    setCommitFocused,
    setIncludeUnstaged,
    setPushEnabled,
    setRepoUrl,
    togglePreviewEnabled,
  } = useComposerGitOpsState({
    diffComments,
    diffCommentsSending,
    onAction,
    onSendDiffComments,
    projectGitState,
  });

  const contentMinHeightClass = useMemo(
    () => cn("relative", hasDiffComments ? "min-h-24" : "min-h-[148px]"),
    [hasDiffComments],
  );

  return (
    <div
      className="grid min-h-[189px] gap-0"
      {...getFeatureStatusDataAttributes("feature:composer.git-ops")}
    >
      {/* This outer height is the reference for the prompt composer too. Keep both surfaces in sync
          so switching between prompt and git-ops does not resize the composer shell. */}
      <div className={contentMinHeightClass}>
        {/* Top git-ops controls are absolutely positioned inside this shared block. The prompt
            composer mirrors this pattern with its + button, prompt body, and send controls. */}
        <ComposerGitOpsTopBar
          commentCards={commentCards}
          diffRenderMode={diffRenderMode}
          hasDiffComments={hasDiffComments}
          hasOrigin={hasOrigin}
          isGitHubOrigin={isGitHubOrigin}
          isGitRepo={isGitRepo}
          onSaveOrigin={handleSaveOrigin}
          onSelectDiffComment={onSelectDiffComment}
          onSetDiffRenderMode={onSetDiffRenderMode}
          onSetRepoUrl={setRepoUrl}
          projectGitState={projectGitState}
          repoUrl={repoUrl}
        />
        {!hasDiffComments ? (
          <ComposerGitOpsMessageField
            actionErrorMessage={actionErrorMessage}
            commitFocused={commitFocused}
            diffCommentError={diffCommentError}
            hasDiffComments={false}
            onBlur={() => setCommitFocused(false)}
            onChange={handleCommitMessageChange}
            onFocus={() => setCommitFocused(true)}
            onLayoutChange={onLayoutChange}
            value={commitMessage}
          />
        ) : null}
      </div>

      {hasDiffComments ? (
        <ComposerGitOpsMessageField
          actionErrorMessage={actionErrorMessage}
          commitFocused={commitFocused}
          diffCommentError={diffCommentError}
          hasDiffComments
          onBlur={() => setCommitFocused(false)}
          onChange={handleCommitMessageChange}
          onFocus={() => setCommitFocused(true)}
          onLayoutChange={onLayoutChange}
          value={commitMessage}
        />
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      {/* Footer row structure here is mirrored by the prompt composer footer. */}
      <ComposerGitOpsFooter
        canCommit={canCommit}
        diffCommentsSending={diffCommentsSending}
        hasDiffComments={hasDiffComments}
        hasOrigin={hasOrigin}
        includeUnstaged={includeUnstaged}
        isGitRepo={isGitRepo}
        onBack={onBack}
        onPrimaryAction={handlePrimaryAction}
        onToggleIncludeUnstaged={() => setIncludeUnstaged((current) => !current)}
        onTogglePreview={togglePreviewEnabled}
        onTogglePush={() => setPushEnabled((current) => !current)}
        previewEnabled={previewEnabled}
        primaryActionLabel={primaryActionLabel}
        projectGitState={projectGitState}
        pushEnabled={pushEnabled}
        runningPrimaryAction={runningPrimaryAction}
      />
    </div>
  );
}
