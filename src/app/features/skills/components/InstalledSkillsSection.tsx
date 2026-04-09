import { FilePenLine, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { SurfacePanel } from "../../../components/common/SurfacePanel";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiConfiguredSkill } from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import {
  compactRoundIconButtonClass,
  popoverPanelClass,
  settingsCompactListRowClass,
} from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type InstalledSkillsSectionProps = {
  installScope: "global" | "project";
  skills: PiConfiguredSkill[];
  isPendingRemove: (installedPath: string) => boolean;
  onRemove: (configuredSkill: PiConfiguredSkill) => Promise<void>;
};

export function InstalledSkillsSection({
  installScope,
  skills,
  isPendingRemove,
  onRemove,
}: InstalledSkillsSectionProps) {
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);
  const confirmRemoveButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRemovePanelRef = useRef<HTMLDivElement>(null);

  useDismissibleLayer({
    open: confirmRemovePath !== null,
    onDismiss: () => setConfirmRemovePath(null),
    refs: [confirmRemoveButtonRef, confirmRemovePanelRef],
  });

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
        No {installScope} skills.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {skills.map((configuredSkill) => (
        <div
          key={`${configuredSkill.scope}:${configuredSkill.installedPath}`}
          className={settingsCompactListRowClass}
        >
          <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
            <div className="shrink-0 text-[13px] leading-4 text-[color:var(--text)]">
              {configuredSkill.displayName}
            </div>
            <div className="min-w-0 truncate text-[12px] leading-4 text-[color:var(--muted)]">
              {configuredSkill.description || configuredSkill.sourceRepo || configuredSkill.source}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip content="Open SKILL.md in default editor">
              <TextButton
                className={compactRoundIconButtonClass}
                onClick={() => void window.piDesktop?.openPath?.(configuredSkill.skillFilePath)}
                aria-label="Open SKILL.md in default editor"
              >
                <FilePenLine size={13} />
              </TextButton>
            </Tooltip>
            <div className="relative">
              <Tooltip
                content={isPendingRemove(configuredSkill.installedPath) ? "Removing" : "Remove"}
              >
                <TextButton
                  ref={
                    confirmRemovePath === configuredSkill.installedPath
                      ? confirmRemoveButtonRef
                      : undefined
                  }
                  className={cn(compactRoundIconButtonClass, "hover:text-[#ffb4b4]")}
                  onClick={() => {
                    if (isPendingRemove(configuredSkill.installedPath)) {
                      return;
                    }

                    setConfirmRemovePath((current) =>
                      current === configuredSkill.installedPath
                        ? null
                        : configuredSkill.installedPath,
                    );
                  }}
                  disabled={isPendingRemove(configuredSkill.installedPath)}
                  aria-label={
                    isPendingRemove(configuredSkill.installedPath) ? "Removing" : "Remove"
                  }
                >
                  <Trash2 size={13} />
                </TextButton>
              </Tooltip>

              {confirmRemovePath === configuredSkill.installedPath ? (
                <SurfacePanel
                  ref={confirmRemovePanelRef}
                  className={cn(
                    "motion-popover absolute top-[calc(100%+6px)] right-0 z-20 flex items-center gap-1 rounded-xl p-1",
                    popoverPanelClass,
                  )}
                  data-open="true"
                >
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-[#ffb4b4] transition-colors hover:bg-[rgba(255,120,120,0.14)]"
                    onClick={() => void onRemove(configuredSkill)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-0.5 text-[10.5px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
                    onClick={() => setConfirmRemovePath(null)}
                  >
                    No
                  </button>
                </SurfacePanel>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
