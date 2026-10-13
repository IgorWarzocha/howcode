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
import type { settingsCategories } from './settingsGroups'
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

  return visibleGroups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 ? (
        <div className="my-2 h-px bg-[rgba(169,178,215,0.18)] lg:col-span-full" />
      ) : null}
      <PopoverBoundary
        as="section"
        className="motion-surface-pulse motion-settings-section-pulse grid min-w-0 gap-1"
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
        <div className="grid">
          {group.settings.map((setting) => (
            <Fragment key={setting.id}>
              {setting.dividerBefore ? (
                <div className="my-2 border-t border-[rgba(169,178,215,0.12)]" />
              ) : null}
              <SettingRow setting={setting} />
            </Fragment>
          ))}
        </div>
      </PopoverBoundary>
    </Fragment>
  ))
}
