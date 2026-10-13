import type { AppShellController } from '../app-shell/useAppShellController'
import type { AppSettings } from '../desktop/types'
import { FALLBACK_APP_SETTINGS } from '../workspace-shell/default-app-settings'
import { classicNavigationRenderer, useNavigationRenderer } from './navigation-selection'
import { RendererSlot } from './renderer-slots'

export function InstalledNavigationHistory({ controller }: { controller: AppShellController }) {
  const settings: AppSettings = controller.desktop.shellState?.appSettings ?? FALLBACK_APP_SETTINGS
  const renderer = useNavigationRenderer(settings.navigationRenderer ?? classicNavigationRenderer)
  const History = renderer?.contribution.navigation?.History
  if (!(renderer && History))
    return <div role="status">Past chats are unavailable. Enable Sidebar in Settings.</div>
  return (
    <RendererSlot name={renderer.name}>
      <History onClose={controller.navigation.closeUtilityView} onOpenChat={controller.chat.open} />
    </RendererSlot>
  )
}
