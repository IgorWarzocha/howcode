import { settingRowClass } from './settingsClasses'
import type { SettingDescriptor } from './settingsTypes'

export function SettingRow({ setting }: { setting: SettingDescriptor }) {
  if (setting.layout === 'rows')
    return (
      <div className="settings-custom-rows" data-setting-id={setting.id}>
        {setting.render()}
      </div>
    )
  const control = <div className="min-w-0 max-w-full">{setting.render()}</div>

  return (
    <div className={settingRowClass} data-setting-id={setting.id}>
      <div className="settings-row-copy">
        <div className="settings-row-title">{setting.title}</div>
        <p className="settings-row-description">{setting.helpDescription ?? setting.description}</p>
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  )
}
