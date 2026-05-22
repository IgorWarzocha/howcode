import { DisclosureSection } from '../../../components/common/disclosure-section'
import type { PiConfiguredPackage } from '../../../desktop/types'
import { inlineEmptyNoteClass } from '../../../ui/classes'
import { skillsListClass, skillsPreviewListClass } from '../../../ui/screen-classes'
import { ConfiguredPackageRow } from './configured-package-row'

type ActiveExtensionsSectionProps = {
  open: boolean
  entries: PiConfiguredPackage[]
  onToggleOpen: () => void
  onRemove: (configuredPackage: PiConfiguredPackage) => void
  isRemovePending: (source: string) => boolean
}

export function ActiveExtensionsSection({
  open,
  entries,
  onToggleOpen,
  onRemove,
  isRemovePending,
}: ActiveExtensionsSectionProps) {
  return (
    <DisclosureSection
      title="Installed"
      open={open}
      onToggle={onToggleOpen}
      forceMountContent
      chevronPosition="right"
    >
      {entries.length > 0 ? (
        <div className={open ? skillsListClass : skillsPreviewListClass}>
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
        <div className={inlineEmptyNoteClass}>No installed extensions.</div>
      )}
    </DisclosureSection>
  )
}
