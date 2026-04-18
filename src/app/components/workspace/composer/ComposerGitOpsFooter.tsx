import { ArrowLeft } from "lucide-react";
import type { RefObject } from "react";
import type { ProjectDiffBaseline, ProjectGitState } from "../../../desktop/types";
import { compactIconButtonClass } from "../../../ui/classes";
import { ComposerDiffBaselineSelector } from "./ComposerDiffBaselineSelector";
import { PlainToggle } from "./PlainToggle";

type ComposerGitOpsFooterProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>;
  diffBaseline: ProjectDiffBaseline;
  hasOrigin: boolean;
  includeUnstaged: boolean;
  isGitRepo: boolean;
  onBack: () => void;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onToggleIncludeUnstaged: () => void;
  onTogglePreview: () => void;
  onTogglePush: () => void;
  previewEnabled: boolean;
  projectGitState: ProjectGitState | null;
  pushEnabled: boolean;
};

export function ComposerGitOpsFooter({
  composerPanelRef,
  diffBaseline,
  hasOrigin,
  includeUnstaged,
  isGitRepo,
  onBack,
  onSetDiffBaseline,
  onToggleIncludeUnstaged,
  onTogglePreview,
  onTogglePush,
  previewEnabled,
  projectGitState,
  pushEnabled,
}: ComposerGitOpsFooterProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
      <div className="flex items-center gap-3">
        <PlainToggle label="Unstaged" checked={includeUnstaged} onClick={onToggleIncludeUnstaged} />
        <PlainToggle label="Preview" checked={previewEnabled} onClick={onTogglePreview} />
        <PlainToggle
          label="Push"
          checked={pushEnabled}
          disabled={!hasOrigin}
          onClick={onTogglePush}
        />
      </div>

      <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
        {isGitRepo ? (
          <ComposerDiffBaselineSelector
            composerPanelRef={composerPanelRef}
            projectId={projectGitState?.projectId ?? ""}
            projectGitState={projectGitState}
            selectedBaseline={diffBaseline}
            onSelectBaseline={onSetDiffBaseline}
          />
        ) : null}
        <button
          type="button"
          className={compactIconButtonClass}
          onClick={onBack}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>
      </div>
    </div>
  );
}
