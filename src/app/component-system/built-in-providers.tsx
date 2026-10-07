import { CodingWorkspacePreferencesProvider } from '@howcode/components/coding/ui/views'
import { DictationDraftInput } from '@howcode/components/dictation/ui'
import type { ToolkitComponentSettings } from '@howcode/shared/toolkit-components'
import type { ReactNode } from 'react'
import { DraftInputContributionContext } from '../composer/draft-input-context'
import type { View } from '../types'
import { ComponentSettingsContext } from './component-context'
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
  return (
    <ComponentSettingsContext value={settings ?? { enabledToolkitComponents: [] }}>
      <DraftInputContributionContext value={DictationDraftInput}>
        <CodingWorkspacePreferencesProvider activeView={activeView}>
          {children}
        </CodingWorkspacePreferencesProvider>
      </DraftInputContributionContext>
    </ComponentSettingsContext>
  )
}
