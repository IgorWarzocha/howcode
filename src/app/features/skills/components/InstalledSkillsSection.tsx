import { FilePenLine, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CompactMetaRow } from "../../../components/common/CompactMetaRow";
import { ConfirmPopover } from "../../../components/common/ConfirmPopover";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiConfiguredSkill } from "../../../desktop/types";
import { compactRoundIconButtonClass } from "../../../ui/classes";
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

  if (skills.length === 0) {
    return <EmptyStateCard>No {installScope} skills.</EmptyStateCard>;
  }

  return (
    <div className="grid gap-2">
      {skills.map((configuredSkill) => (
        <CompactMetaRow
          key={`${configuredSkill.scope}:${configuredSkill.installedPath}`}
          actions={
            <>
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

                <ConfirmPopover
                  open={confirmRemovePath === configuredSkill.installedPath}
                  anchorRef={confirmRemoveButtonRef}
                  onClose={() => setConfirmRemovePath(null)}
                  onConfirm={() => void onRemove(configuredSkill)}
                />
              </div>
            </>
          }
        >
          <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
            <div className="shrink-0 text-[13px] leading-4 text-[color:var(--text)]">
              {configuredSkill.displayName}
            </div>
            <div className="min-w-0 truncate text-[12px] leading-4 text-[color:var(--muted)]">
              {configuredSkill.description || configuredSkill.sourceRepo || configuredSkill.source}
            </div>
          </div>
        </CompactMetaRow>
      ))}
    </div>
  );
}
