import { DisclosureSection } from "../../../components/common/DisclosureSection";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
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
    <DisclosureSection title="Installed" open={open} onToggle={onToggleOpen}>
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
          <EmptyStateCard>No installed extensions.</EmptyStateCard>
        )
      ) : null}
    </DisclosureSection>
  );
}
