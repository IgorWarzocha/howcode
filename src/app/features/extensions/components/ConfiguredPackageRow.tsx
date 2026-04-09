import { FilePenLine, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CompactMetaRow } from "../../../components/common/CompactMetaRow";
import { ConfirmPopover } from "../../../components/common/ConfirmPopover";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiConfiguredPackage } from "../../../desktop/types";
import { compactRoundIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { getConfiguredSourceLabel, isConfiguredSourcePath } from "../utils";

type ConfiguredPackageRowProps = {
  configuredPackage: PiConfiguredPackage;
  removePending: boolean;
  onRemove: (configuredPackage: PiConfiguredPackage) => void;
};

export function ConfiguredPackageRow({
  configuredPackage,
  removePending,
  onRemove,
}: ConfiguredPackageRowProps) {
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const sourceLabel = getConfiguredSourceLabel(configuredPackage);

  return (
    <CompactMetaRow
      actions={
        <>
          {(configuredPackage.type === "local" || configuredPackage.resourceKind === "extension") &&
          configuredPackage.settingsPath ? (
            <Tooltip content="Open settings.json in default editor">
              <TextButton
                className={compactRoundIconButtonClass}
                onClick={() => {
                  if (configuredPackage.settingsPath) {
                    void window.piDesktop?.openPath?.(configuredPackage.settingsPath);
                  }
                }}
                aria-label="Open settings.json in default editor"
              >
                <FilePenLine size={13} />
              </TextButton>
            </Tooltip>
          ) : null}

          {configuredPackage.resourceKind === "package" ? (
            <div className="relative">
              <Tooltip content={removePending ? "Removing" : "Remove"}>
                <TextButton
                  ref={removeButtonRef}
                  className={cn(compactRoundIconButtonClass, "hover:text-[#ffb4b4]")}
                  onClick={() => {
                    if (removePending) {
                      return;
                    }

                    setConfirmRemoveOpen((current) => !current);
                  }}
                  disabled={removePending}
                  aria-label={removePending ? "Removing" : "Remove"}
                >
                  <Trash2 size={13} />
                </TextButton>
              </Tooltip>

              <ConfirmPopover
                open={confirmRemoveOpen}
                anchorRef={removeButtonRef}
                onClose={() => setConfirmRemoveOpen(false)}
                onConfirm={() => void onRemove(configuredPackage)}
              />
            </div>
          ) : null}
        </>
      }
    >
      <div className="min-w-0 flex items-baseline gap-1.5 overflow-hidden">
        <div className="shrink-0 text-[13px] leading-4 text-[color:var(--text)]">
          {configuredPackage.displayName}
        </div>
        <div
          className={cn(
            "text-[12px] leading-4 text-[color:var(--muted)]",
            isConfiguredSourcePath(configuredPackage) ? "min-w-0 truncate" : "shrink-0",
          )}
        >
          {sourceLabel}
        </div>
      </div>
    </CompactMetaRow>
  );
}
