import { FilePenLine, Trash2 } from "lucide-react";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import type { PiConfiguredPackage } from "../../../desktop/types";
import { settingsListRowClass } from "../../../ui/classes";
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
  return (
    <div
      key={`${configuredPackage.scope}:${configuredPackage.source}`}
      className={cn(settingsListRowClass, "gap-2 py-2")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="truncate text-[13px] text-[color:var(--text)]">
          {configuredPackage.displayName}
        </div>
        {isConfiguredSourcePath(configuredPackage) ? (
          <div className="truncate text-[12px] text-[color:var(--muted)]">
            {getConfiguredSourceLabel(configuredPackage)}
          </div>
        ) : (
          <div className="shrink-0 text-[12px] text-[color:var(--muted)]">
            {getConfiguredSourceLabel(configuredPackage)}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {(configuredPackage.type === "local" || configuredPackage.resourceKind === "extension") &&
        configuredPackage.settingsPath ? (
          <Tooltip content="Open settings.json in default editor">
            <TextButton
              className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
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
          <Tooltip content={removePending ? "Removing" : "Remove"}>
            <TextButton
              className="inline-flex h-8 w-8 items-center justify-center rounded-full px-0 text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#ffb4b4]"
              onClick={() => onRemove(configuredPackage)}
              disabled={removePending}
              aria-label={removePending ? "Removing" : "Remove"}
            >
              <Trash2 size={13} />
            </TextButton>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
