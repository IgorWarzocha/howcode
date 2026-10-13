import { GitRendererBridgeProvider } from '@howaboua/howcode-sdk/git-renderer'
import type { SkillsRendererPort } from '@howaboua/howcode-sdk/skills-renderer'
import { isToolkitComponentEnabled } from '@howcode/shared/toolkit-components'
import type { ReactNode } from 'react'
import type { AppSettings } from '../desktop/types'
import type { View } from '../types'
import { WorkspaceLayoutActionsProvider } from '../workspace-shell/workspace-layout-actions'
import { ComponentSettingsContext } from './component-context'
import { InstalledComponentProviders } from './installed-providers'
import { classicNavigationRenderer } from './navigation-selection'

export function BuiltInComponentProviders({
  settings,
  workView,
  skills,
  children,
}: {
  settings: AppSettings | undefined
  workView: View
  skills: SkillsRendererPort
  children: ReactNode
}) {
  const retainGitPreferences = workView !== 'chat'
  return (
    <ComponentSettingsContext value={settings ?? { enabledToolkitComponents: [] }}>
      <GitRendererBridgeProvider>
        <InstalledComponentProviders
          enabled={true}
          retain={retainGitPreferences}
          terminalEnabled={isToolkitComponentEnabled(settings, 'terminal')}
          skillsEnabled={isToolkitComponentEnabled(settings, 'skills')}
          skills={skills}
          navigationRenderer={
            settings ? (settings.navigationRenderer ?? classicNavigationRenderer) : 'none'
          }
        >
          <WorkspaceLayoutActionsProvider>{children}</WorkspaceLayoutActionsProvider>
        </InstalledComponentProviders>
      </GitRendererBridgeProvider>
    </ComponentSettingsContext>
  )
}
