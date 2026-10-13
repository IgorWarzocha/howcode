import {
  appToneMutedClass,
  appToneTextClass,
  appTypeMetaClass,
  appTypeSmallClass,
} from '@howaboua/howcode-sdk/ui/typography-scale'
import { settingRowClass } from './settingsClasses'
import type { SettingDescriptor } from './settingsTypes'

export function SettingRow({ setting }: { setting: SettingDescriptor }) {
  const control = <div className="min-w-0 max-w-full">{setting.render()}</div>

  return (
    <div className={settingRowClass} data-setting-id={setting.id}>
      <div className="grid min-w-0 gap-1">
        <div className={`${appTypeSmallClass} ${appToneTextClass}`}>{setting.title}</div>
        <p className={`${appTypeMetaClass} ${appToneMutedClass}`}>
          {setting.helpDescription ?? setting.description}
        </p>
      </div>
      <div className="min-w-0 max-w-full justify-self-stretch sm:justify-self-end">{control}</div>
    </div>
  )
}
