import { DictationDraftInput } from '@howcode/components/dictation/ui'
import type { ToolkitComponentSettings } from '@howcode/shared/toolkit-components'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { ReactNode } from 'react'
import { DraftInputContributionContext } from '../composer/draft-input-context'
import type { View } from '../types'
import { WorkspaceLayoutActionsProvider } from '../workspace-shell/workspace-layout-actions'
import { ComponentSettingsContext } from './component-context'
import { InstalledComponentProviders } from './installed-providers'

export function BuiltInComponentProviders({
  settings,
  workView,
  children,
}: {
  settings: ToolkitComponentSettings | undefined
  workView: View
  children: ReactNode
}) {
  const enabled = isToolkitComponentEnabled(settings, 'coding')
  const retainGitPreferences = workView !== 'chat'
  return (
    <ComponentSettingsContext value={settings ?? { enabledToolkitComponents: [] }}>
      <DraftInputContributionContext value={DictationDraftInput}>
        <InstalledComponentProviders enabled={enabled} retain={retainGitPreferences}>
          <WorkspaceLayoutActionsProvider>{children}</WorkspaceLayoutActionsProvider>
        </InstalledComponentProviders>
      </DraftInputContributionContext>
    </ComponentSettingsContext>
  )
}
