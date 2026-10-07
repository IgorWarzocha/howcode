import { CodingWorkspacePreferencesProvider } from '@howcode/plugins/coding/ui/views'
import { DictationDraftInput } from '@howcode/plugins/dictation/ui'
import type { ToolkitExtensionSettings } from '@howcode/shared/toolkit-extensions'
import type { ReactNode } from 'react'
import { DraftInputContributionContext } from '../composer/draft-input-context'
import type { View } from '../types'
import { ToolkitSettingsContext } from './toolkit-context'
import { isWorkspaceViewEnabled } from './toolkit-plugins'

export function BuiltInExtensionProviders({
  settings,
  selectedView,
  children,
}: {
  settings: ToolkitExtensionSettings | undefined
  selectedView: View
  children: ReactNode
}) {
  const activeView = isWorkspaceViewEnabled(settings, selectedView) ? selectedView : 'chat'
  return (
    <ToolkitSettingsContext value={settings ?? { enabledToolkitExtensions: [] }}>
      <DraftInputContributionContext value={DictationDraftInput}>
        <CodingWorkspacePreferencesProvider activeView={activeView}>
          {children}
        </CodingWorkspacePreferencesProvider>
      </DraftInputContributionContext>
    </ToolkitSettingsContext>
  )
}
