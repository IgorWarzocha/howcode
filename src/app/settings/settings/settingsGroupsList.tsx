import { Fragment } from 'react'
import { PopoverBoundary } from '../../common/popover'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeBodyClass,
  appTypeMetaClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
  inlineEmptyNoteClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'
import { settingsHelpRowClass } from './settingsClasses'
import type { settingsCategories } from './settingsGroups'
import type { SettingsCategoryId } from './settingsTypes'
import { SettingRow } from './settingsUi'

type VisibleSettingsGroup = (typeof settingsCategories)[number] & {
  settings: Parameters<typeof SettingRow>[0]['setting'][]
}

function getCategoryHelpIntro(categoryId: SettingsCategoryId) {
  if (categoryId !== 'shortcuts') return null
  return 'Shortcuts require at least one modifier — Ctrl, Shift, Alt, or Command — plus one key.'
}

export function SettingsGroupsList({
  visibleGroups,
  showHelp,
  highlightedCategoryId,
  settingRowHeights,
}: {
  visibleGroups: VisibleSettingsGroup[]
  showHelp: boolean
  highlightedCategoryId: SettingsCategoryId | null
  settingRowHeights: Record<string, number>
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
        <div className="grid">
          {group.settings.map((setting) => (
            <Fragment key={setting.id}>
              {setting.dividerBefore ? (
                <div className="my-2 border-t border-[rgba(169,178,215,0.12)]" />
              ) : null}
              <SettingRow setting={setting} showHelp={showHelp} />
            </Fragment>
          ))}
        </div>
      </PopoverBoundary>
      {showHelp ? (
        <aside className="hidden min-w-0 content-start gap-1 rounded-[18px] border border-transparent p-2.5 lg:grid">
          <div
            className={cn(
              'flex items-baseline gap-3 px-1 pt-1 pb-1',
              getCategoryHelpIntro(group.id) && 'min-h-10 items-start',
            )}
          >
            {getCategoryHelpIntro(group.id) ? (
              <span className={`min-w-0 ${appTypeMetaClass} text-wrap ${appToneMutedClass}`}>
                {getCategoryHelpIntro(group.id)}
              </span>
            ) : (
              <h2 className={`invisible ${appTypeSectionTitleClass}`}>{group.label}</h2>
            )}
          </div>
          <div className="grid min-w-0">
            {group.settings.map((setting) => (
              <Fragment key={setting.id}>
                {setting.dividerBefore ? (
                  <div className="my-2 border-t border-transparent" />
                ) : null}
                <div
                  className={settingsHelpRowClass}
                  style={
                    settingRowHeights[setting.id]
                      ? { height: `${settingRowHeights[setting.id]}px` }
                      : undefined
                  }
                >
                  <span className="relative top-[10px] truncate">
                    {setting.helpDescription ?? setting.description}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        </aside>
      ) : null}
    </Fragment>
  ))
}
