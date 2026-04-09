import { ChevronDown, ChevronRight } from "lucide-react";
import type { PiConfiguredPackage } from "../../../desktop/types";
import { ConfiguredPackageRow } from "./ConfiguredPackageRow";

type ActiveExtensionsSectionProps = {
  open: boolean;
  entries: PiConfiguredPackage[];
  onToggleOpen: () => void;
  onRemove: (configuredPackage: PiConfiguredPackage) => void;
  isRemovePending: (source: string) => boolean;
};

export function ActiveExtensionsSection({
  open,
  entries,
  onToggleOpen,
  onRemove,
  isRemovePending,
}: ActiveExtensionsSectionProps) {
  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]"
        onClick={onToggleOpen}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Active</span>
      </button>

      {open ? (
        entries.length > 0 ? (
          <div className="grid gap-2">
            {entries.map((configuredPackage) => (
              <ConfiguredPackageRow
                key={`${configuredPackage.scope}:${configuredPackage.source}`}
                configuredPackage={configuredPackage}
                removePending={isRemovePending(configuredPackage.source)}
                onRemove={onRemove}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-[12px] text-[color:var(--muted)]">
            No installed extensions.
          </div>
        )
      ) : null}
    </div>
  );
}
