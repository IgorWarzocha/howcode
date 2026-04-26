import { type RefObject, useEffect, useMemo } from "react";
import type {
  DesktopActionInvoker,
  ProjectDiffBaseline,
  ProjectGitState,
} from "../../../desktop/types";
import { getFeatureStatusDataAttributes } from "../../../features/feature-status";
import { composerTextActionButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import type { SavedDiffComment } from "../diff/diffCommentStore";
import { ComposerDictationControls } from "./ComposerDictationControls";
import { ComposerGitOpsFooter } from "./ComposerGitOpsFooter";
import { ComposerGitOpsMessageField } from "./ComposerGitOpsMessageField";
import { ComposerGitOpsTopBar } from "./ComposerGitOpsTopBar";
import { useComposerDictation } from "./useComposerDictation";
import { useComposerGitOpsState } from "./useComposerGitOpsState";

type ComposerGitOpsSurfaceProps = {
  dictationModelId: string | null;
  dictationMaxDurationSeconds: number;
  composerPanelRef: RefObject<HTMLDivElement | null>;
  onOpenSettingsView: () => void;
  projectGitState: ProjectGitState | null;
  projectId: string;
  sessionPath: string | null;
  showDictationButton: boolean;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: "stacked" | "split";
  diffComments: SavedDiffComment[];
  diffCommentCount: number;
  diffCommentsSending: boolean;
  diffCommentError: string | null;
  diffLoadError: string | null;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSendDiffComments: (message?: string | null) => void;
  onSelectDiffComment: (filePath: string, commentId: string) => void;
  onAction: DesktopActionInvoker;
  onLayoutChange: () => void;
  onBack: () => void;
};

export function ComposerGitOpsSurface({
  dictationModelId,
  dictationMaxDurationSeconds,
  composerPanelRef,
  onOpenSettingsView,
  projectGitState,
  projectId,
  sessionPath,
  showDictationButton,
  diffBaseline,
  diffRenderMode,
  diffComments,
  diffCommentCount,
  diffCommentsSending,
  diffCommentError,
  diffLoadError,
  onSetDiffBaseline,
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
    setActionErrorMessage,
    setCommitMessageValue,
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
    () => cn("relative", hasDiffComments && "min-h-24"),
    [hasDiffComments],
  );

  const {
    cancelDictation,
    dictationActive,
    dictationInterimText,
    dictationMissingModel,
    dictationSupported,
    toggleDictation,
  } = useComposerDictation({
    activeView: "gitops",
    dictationModelId,
    dictationMaxDurationSeconds,
    draftThreadId: `gitops:${projectId}`,
    projectId,
    sessionPath,
    setDraftValue: setCommitMessageValue,
    setErrorMessage: setActionErrorMessage,
  });
  const dictationTranscribing = dictationInterimText.length > 0;

  useEffect(() => {
    if (!dictationActive && !dictationTranscribing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      (document.activeElement as HTMLElement | null)?.blur?.();
      void cancelDictation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [cancelDictation, dictationActive, dictationTranscribing]);

  const dictationControls = (
    <ComposerDictationControls
      dictationActive={dictationActive}
      dictationMissingModel={dictationMissingModel}
      dictationSupported={dictationSupported}
      dictationTranscribing={dictationTranscribing}
      onAction={onAction}
      onOpenSettingsView={onOpenSettingsView}
      showDictationButton={showDictationButton}
      toggleDictation={toggleDictation}
    />
  );
  const primaryActionButton = (
    <button
      type="button"
      className={composerTextActionButtonClass}
      onClick={() => {
        void handlePrimaryAction();
      }}
      disabled={
        hasDiffComments
          ? diffCommentsSending
          : runningPrimaryAction || (isGitRepo ? !canCommit : false)
      }
      aria-label={primaryActionLabel}
    >
      {primaryActionLabel}
    </button>
  );
  const trailingActions = (
    <div className="inline-flex items-center gap-2">
      {dictationControls}
      {primaryActionButton}
    </div>
  );

  return (
    <div className="grid gap-0" {...getFeatureStatusDataAttributes("feature:composer.git-ops")}>
      {/* Keep one-line default height here too, then let the field grow upward as content expands. */}
      <div className={contentMinHeightClass}>
        {/* Top git-ops controls are absolutely positioned inside this shared block. The prompt
            composer mirrors this pattern with its + button, prompt body, and send controls. */}
        {hasDiffComments ? (
          <ComposerGitOpsTopBar
            commentCards={commentCards}
            hasDiffComments={hasDiffComments}
            hasOrigin={hasOrigin}
            isGitHubOrigin={isGitHubOrigin}
            isGitRepo={isGitRepo}
            onSaveOrigin={handleSaveOrigin}
            onSelectDiffComment={onSelectDiffComment}
            onSetRepoUrl={setRepoUrl}
            projectGitState={projectGitState}
            repoUrl={repoUrl}
          />
        ) : null}
        {!hasDiffComments ? (
          <ComposerGitOpsMessageField
            actionErrorMessage={actionErrorMessage}
            commitFocused={commitFocused}
            diffCommentError={diffCommentError ?? diffLoadError}
            hasDiffComments={false}
            isGitRepo={isGitRepo}
            onBlur={() => setCommitFocused(false)}
            onChange={handleCommitMessageChange}
            onFocus={() => setCommitFocused(true)}
            onInput={() => {
              if (actionErrorMessage) {
                setActionErrorMessage(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && (dictationActive || dictationTranscribing)) {
                event.preventDefault();
                void cancelDictation();
              }
            }}
            onLayoutChange={onLayoutChange}
            trailingAccessory={trailingActions}
            value={commitMessage}
          />
        ) : null}
      </div>

      {hasDiffComments ? (
        <ComposerGitOpsMessageField
          actionErrorMessage={actionErrorMessage}
          commitFocused={commitFocused}
          diffCommentError={diffCommentError ?? diffLoadError}
          hasDiffComments
          isGitRepo={isGitRepo}
          onBlur={() => setCommitFocused(false)}
          onChange={handleCommitMessageChange}
          onFocus={() => setCommitFocused(true)}
          onInput={() => {
            if (actionErrorMessage) {
              setActionErrorMessage(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && (dictationActive || dictationTranscribing)) {
              event.preventDefault();
              void cancelDictation();
            }
          }}
          onLayoutChange={onLayoutChange}
          trailingAccessory={trailingActions}
          value={commitMessage}
        />
      ) : null}

      <div className="h-px bg-[rgba(169,178,215,0.07)]" />

      {/* Footer row structure here is mirrored by the prompt composer footer. */}
      <ComposerGitOpsFooter
        composerPanelRef={composerPanelRef}
        diffBaseline={diffBaseline}
        diffRenderMode={diffRenderMode}
        hasOrigin={hasOrigin}
        includeUnstaged={includeUnstaged}
        isGitRepo={isGitRepo}
        onSaveOrigin={handleSaveOrigin}
        onBack={onBack}
        onSetDiffBaseline={onSetDiffBaseline}
        onSetDiffRenderMode={onSetDiffRenderMode}
        onSetRepoUrl={setRepoUrl}
        onToggleIncludeUnstaged={() => setIncludeUnstaged((current) => !current)}
        onTogglePreview={togglePreviewEnabled}
        onTogglePush={() => setPushEnabled((current) => !current)}
        previewEnabled={previewEnabled}
        projectGitState={projectGitState}
        pushEnabled={pushEnabled}
        repoUrl={repoUrl}
      />
    </div>
  );
}
