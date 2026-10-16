import {
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSectionTitleClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { settingRowClass } from './settingsClasses'
import type { SettingDescriptor } from './settingsTypes'

export function SettingRow({ setting }: { setting: SettingDescriptor }) {
  const control = <div className="min-w-0 max-w-full">{setting.render()}</div>

  return (
    <div
      className={setting.layout === 'stacked' ? 'grid min-w-0 gap-3 px-1 py-3' : settingRowClass}
      data-setting-id={setting.id}
    >
      <div className="grid min-w-0 gap-1">
        {setting.layout === 'stacked' ? (
          <h3 className={`${appTypeSectionTitleClass} ${appToneTextClass}`}>{setting.title}</h3>
        ) : (
          <div className={`${appTypeSmallClass} ${appToneTextClass}`}>{setting.title}</div>
        )}
        <p className={`${appTypeMetaClass} ${appToneMutedClass}`}>
          {setting.helpDescription ?? setting.description}
        </p>
      </div>
      <div
        className={
          setting.layout === 'stacked'
            ? 'min-w-0 max-w-full'
            : 'min-w-0 max-w-full justify-self-stretch sm:justify-self-end'
        }
      >
        {control}
      </div>
    </div>
  )
}
