import { DictationDraftInput } from '@howcode/components/dictation/ui'
import type { ToolkitComponentSettings } from '@howcode/shared/toolkit-components'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { ReactNode } from 'react'
import { DraftInputContributionContext } from '../composer/draft-input-context'
import type { View } from '../types'
import { ComponentSettingsContext } from './component-context'
import { InstalledComponentProviders } from './installed-providers'
import { isWorkspaceViewEnabled } from './toolkit-components'

export function BuiltInComponentProviders({
  settings,
  selectedView,
  children,
}: {
  settings: ToolkitComponentSettings | undefined
  selectedView: View
  children: ReactNode
}) {
  const activeView = isWorkspaceViewEnabled(settings, selectedView) ? selectedView : 'chat'
  const enabled = isToolkitComponentEnabled(settings, 'coding')
  const retainGitPreferences =
    activeView !== 'chat' &&
    activeView !== 'claw' &&
    activeView !== 'work' &&
    activeView !== 'automations'
  return (
    <ComponentSettingsContext value={settings ?? { enabledToolkitComponents: [] }}>
      <DraftInputContributionContext value={DictationDraftInput}>
        <InstalledComponentProviders enabled={enabled} retain={retainGitPreferences}>
          {children}
        </InstalledComponentProviders>
      </DraftInputContributionContext>
    </ComponentSettingsContext>
  )
}
