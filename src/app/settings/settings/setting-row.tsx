import { Tooltip } from '@howaboua/howcode-sdk/common/tooltip'
import { appToneTextClass, appTypeSmallClass } from '@howaboua/howcode-sdk/ui/typography-scale'
import { settingRowClass } from './settingsClasses'
import type { SettingDescriptor } from './settingsTypes'

export function SettingRow({
  setting,
  showHelp,
}: {
  setting: SettingDescriptor
  showHelp: boolean
}) {
  const title = (
    <div className={`min-w-0 truncate ${appTypeSmallClass} ${appToneTextClass}`}>
      {setting.title}
    </div>
  )
  const control = <div className="min-w-0 max-w-full">{setting.render()}</div>

  return (
    <div className={settingRowClass} data-setting-id={setting.id}>
      {showHelp ? (
        title
      ) : (
        <Tooltip
          content={setting.description}
          delayMs={1000}
          className="block min-w-0"
          tabIndex={0}
        >
          {title}
        </Tooltip>
      )}
      <div className="min-w-0 max-w-full justify-self-stretch sm:justify-self-end">{control}</div>
    </div>
  )
}
