import { ArrowLeft, Columns2, Rows3, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ProjectDiffBaseline, ProjectGitState } from "../../../desktop/types";
import {
  compactIconButtonClass,
  diffPanelIconButtonClass,
  diffPanelTurnChipSelectedClass,
  popoverPanelClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { ComposerDiffBaselineSelector } from "./ComposerDiffBaselineSelector";
import { PlainToggle } from "./PlainToggle";

type ComposerGitOpsFooterProps = {
  composerPanelRef: RefObject<HTMLDivElement | null>;
  diffBaseline: ProjectDiffBaseline;
  diffRenderMode: "stacked" | "split";
  hasOrigin: boolean;
  includeUnstaged: boolean;
  isGitRepo: boolean;
  onSaveOrigin: () => void;
  onBack: () => void;
  onSetDiffBaseline: (baseline: ProjectDiffBaseline) => void;
  onSetDiffRenderMode: (mode: "stacked" | "split") => void;
  onSetRepoUrl: (repoUrl: string) => void;
  onToggleIncludeUnstaged: () => void;
  onTogglePreview: () => void;
  onTogglePush: () => void;
  previewEnabled: boolean;
  projectGitState: ProjectGitState | null;
  pushEnabled: boolean;
  repoUrl: string;
};

export function ComposerGitOpsFooter({
  composerPanelRef,
  diffBaseline,
  diffRenderMode,
  hasOrigin,
  includeUnstaged,
  isGitRepo,
  onSaveOrigin,
  onBack,
  onSetDiffBaseline,
  onSetDiffRenderMode,
  onSetRepoUrl,
  onToggleIncludeUnstaged,
  onTogglePreview,
  onTogglePush,
  previewEnabled,
  projectGitState,
  pushEnabled,
  repoUrl,
}: ComposerGitOpsFooterProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const originSaveRequestedRef = useRef(false);

  const saveOriginOnce = useCallback(() => {
    if (hasOrigin || repoUrl.trim().length === 0 || originSaveRequestedRef.current) {
      return;
    }

    originSaveRequestedRef.current = true;
    void Promise.resolve(onSaveOrigin()).finally(() => {
      originSaveRequestedRef.current = false;
    });
  }, [hasOrigin, onSaveOrigin, repoUrl]);

  useEffect(() => {
    if (!optionsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && optionsRef.current?.contains(target)) {
        return;
      }

      saveOriginOnce();

      window.setTimeout(() => setOptionsOpen(false), 0);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [optionsOpen, saveOriginOnce]);

  useEffect(() => {
    if (!optionsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setOptionsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [optionsOpen]);

  return (
    <div className="flex items-center gap-1.5 px-4 pt-2 pb-3 text-[color:var(--muted)] max-md:flex-wrap">
      {isGitRepo ? (
        <div className="inline-flex items-center gap-1.5">
          <div ref={optionsRef} className="relative inline-flex">
            <button
              type="button"
              className={cn(compactIconButtonClass, "h-7 w-7")}
              onClick={() => setOptionsOpen((current) => !current)}
              aria-label="Commit options"
              aria-haspopup="menu"
              aria-expanded={optionsOpen}
              title="Commit options"
            >
              <Settings size={14} />
            </button>

            {optionsOpen ? (
              <div
                className={cn(
                  popoverPanelClass,
                  "absolute bottom-[calc(100%+8px)] left-0 z-20 grid min-w-56 gap-2 rounded-xl border p-3",
                )}
                role="menu"
                aria-label="Commit options"
              >
                {!hasOrigin ? (
                  <input
                    value={repoUrl}
                    onChange={(event) => onSetRepoUrl(event.target.value)}
                    onBlur={() => {
                      saveOriginOnce();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveOriginOnce();
                      }
                    }}
                    className="min-h-7 rounded-lg border border-[color:var(--border)] bg-[rgba(255,255,255,0.03)] px-2.5 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted-2)]"
                    placeholder="Repository URL"
                    aria-label="Repository URL"
                  />
                ) : null}
                <PlainToggle
                  label="Include unstaged"
                  checked={includeUnstaged}
                  onClick={onToggleIncludeUnstaged}
                  toggleSide="left"
                />
                <PlainToggle
                  label="Draft message"
                  checked={previewEnabled}
                  onClick={onTogglePreview}
                  toggleSide="left"
                />
                <PlainToggle
                  label="Commit & push"
                  checked={pushEnabled}
                  disabled={!hasOrigin}
                  onClick={onTogglePush}
                  toggleSide="left"
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === "stacked"
                ? diffPanelTurnChipSelectedClass
                : "border-[color:var(--border)] bg-transparent",
            )}
            onClick={() => onSetDiffRenderMode("stacked")}
            aria-label="Unified diff view"
            title="Unified diff view"
          >
            <Rows3 size={14} />
          </button>
          <button
            type="button"
            className={cn(
              diffPanelIconButtonClass,
              diffRenderMode === "split"
                ? diffPanelTurnChipSelectedClass
                : "border-[color:var(--border)] bg-transparent",
            )}
            onClick={() => onSetDiffRenderMode("split")}
            aria-label="Split diff view"
            title="Split diff view"
          >
            <Columns2 size={14} />
          </button>
        </div>
      ) : null}

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
          className={cn(compactIconButtonClass, "h-7 w-7")}
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
