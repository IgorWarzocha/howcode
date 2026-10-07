import type { WorkspaceViewContributions } from '@howcode/extensions/workspace-views'
import type { View } from '../types'

type AppShellWorkspaceProps = {
  activeView: View
  contributions: WorkspaceViewContributions
}

export function AppShellWorkspace({ activeView, contributions }: AppShellWorkspaceProps) {
  const content = contributions[activeView]
  if (!content) {
    return <div role="alert">Unsupported workspace view: {activeView}</div>
  }
  return content
}
