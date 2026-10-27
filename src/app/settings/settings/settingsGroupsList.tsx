import { PopoverBoundary } from '@howaboua/howcode-sdk/common/popover'
import { inlineEmptyNoteClass } from '@howaboua/howcode-sdk/ui/classes'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { Fragment } from 'react'
import { SettingRow } from './setting-row'
import { groupSettingsBySection, type settingsCategories } from './settingsGroups'
import type { SettingsCategoryId } from './settingsTypes'

type VisibleSettingsGroup = (typeof settingsCategories)[number] & {
  settings: Parameters<typeof SettingRow>[0]['setting'][]
}

function getCategoryHelpIntro(categoryId: SettingsCategoryId) {
  if (categoryId !== 'shortcuts') return null
  return 'Shortcuts require at least one modifier — Ctrl, Shift, Alt, or Command — plus one key.'
}

export function SettingsGroupsList({
  visibleGroups,
  highlightedCategoryId,
}: {
  visibleGroups: VisibleSettingsGroup[]
  highlightedCategoryId: SettingsCategoryId | null
}) {
  if (visibleGroups.length === 0) {
    return (
      <div className={cn(inlineEmptyNoteClass, 'lg:col-span-full')}>
        <div className={`${appTypeBodyClass} ${appToneTextClass}`}>No matching settings</div>
        <div className={`mt-1 ${appTypeSmallClass} ${appToneMutedClass}`}>
          Try a broader term like “Pi”, “model”, “folder”, or “voice”.
        </div>
      </div>
    )
  }

  return visibleGroups.map((group) => (
    <PopoverBoundary
      key={group.id}
      as="section"
      className="motion-surface-pulse motion-settings-section-pulse settings-category-group"
      data-pulse-active={group.id === highlightedCategoryId ? 'true' : 'false'}
    >
      <div
        className={cn(
          'flex items-baseline justify-between gap-3 px-1 pt-1 pb-1',
          getCategoryHelpIntro(group.id) && 'min-h-10 items-start',
        )}
      >
        <h2 className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>{group.label}</h2>
      </div>
      {getCategoryHelpIntro(group.id) ? (
        <p className={`px-1 pb-2 ${appTypeSmallClass} ${appToneMutedClass}`}>
          {getCategoryHelpIntro(group.id)}
        </p>
      ) : null}
      {groupSettingsBySection(group.settings, group.label).map((section) => (
        <PopoverBoundary className="settings-section" key={section.label}>
          {section.label === group.label ? null : <h3>{section.label}</h3>}
          <div className="settings-panel">
            {section.settings.map((setting) => (
              <Fragment key={setting.id}>
                {setting.dividerBefore ? <div className="settings-divider" /> : null}
                <SettingRow setting={setting} />
              </Fragment>
            ))}
          </div>
        </PopoverBoundary>
      ))}
    </PopoverBoundary>
  ))
}
