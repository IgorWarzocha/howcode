import { FilePenLine, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { SurfacePanel } from "../../../components/common/SurfacePanel";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiConfiguredPackage } from "../../../desktop/types";
import { useDismissibleLayer } from "../../../hooks/useDismissibleLayer";
import {
  compactRoundIconButtonClass,
  popoverPanelClass,
  settingsCompactListRowClass,
} from "../../../ui/classes";
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
  const removePanelRef = useRef<HTMLDivElement>(null);
  const sourceLabel = getConfiguredSourceLabel(configuredPackage);

  useDismissibleLayer({
    open: confirmRemoveOpen,
    onDismiss: () => setConfirmRemoveOpen(false),
    refs: [removeButtonRef, removePanelRef],
  });

  return (
    <div className={settingsCompactListRowClass}>
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

      <div className="flex items-center gap-0.5">
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
                ref={confirmRemoveOpen ? removeButtonRef : undefined}
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

            {confirmRemoveOpen ? (
              <SurfacePanel
                ref={removePanelRef}
                className={cn(
                  "motion-popover absolute top-[calc(100%+6px)] right-0 z-20 flex items-center gap-1 rounded-xl p-1",
                  popoverPanelClass,
                )}
                data-open="true"
              >
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-[#ffb4b4] transition-colors hover:bg-[rgba(255,120,120,0.14)]"
                  onClick={() => void onRemove(configuredPackage)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
                  onClick={() => setConfirmRemoveOpen(false)}
                >
                  No
                </button>
              </SurfacePanel>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
