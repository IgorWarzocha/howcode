import { SidebarRendererBridgeProvider } from '@howaboua/howcode-sdk/sidebar-renderer'
import { composerTextActionButtonClass } from '@howaboua/howcode-sdk/ui/classes'
import { useMemo } from 'react'
import { AppShellLayout } from './app-shell/app-shell-layout'
import { useAppShellController } from './app-shell/useAppShellController'
import { usePiGuiTheme } from './app-shell/usePiGuiTheme'
import { BuiltInComponentProviders } from './component-system/built-in-providers'
import { openPiResourceUrl } from './pi-resources/open-pi-resource-url'

export function AppShell() {
  return (
    <SidebarRendererBridgeProvider>
      <AppShellContents />
    </SidebarRendererBridgeProvider>
  )
}

function AppShellContents() {
  const controller = useAppShellController()
  const directoryPath = controller.workspace.state.hasSelectedDirectory
    ? controller.workspace.state.selectedDirectoryId || null
    : null
  const { setSkillsActive } = controller.resourceScope
  const { closeUtilityView } = controller.navigation
  const skills = useMemo(
    () => ({
      openUrl: openPiResourceUrl,
      directoryPath,
      onSetDirectoryScopeActive: setSkillsActive,
      onDirectoryTargetSelected: () => setSkillsActive(true),
      subscribeDirectoryTarget: (listener: () => void) => {
        window.addEventListener('howcode:project-target-selected', listener)
        return () => window.removeEventListener('howcode:project-target-selected', listener)
      },
      onClose: closeUtilityView,
    }),
    [directoryPath, setSkillsActive, closeUtilityView],
  )
  usePiGuiTheme(controller.desktop.shellState?.piTheme)
  if (!(controller.desktop.shellState && controller.workspaces.state)) {
    const error = controller.desktop.shellError ?? controller.workspaces.error
    return (
      <main className="grid h-full place-content-center gap-3 p-6">
        {error ? (
          <>
            <div role="alert" className="grid max-w-xl gap-2">
              <h1>Could not load Howcode</h1>
              <p className="break-words text-sm text-[color:var(--muted)]">{error.message}</p>
            </div>
            <button
              type="button"
              className={composerTextActionButtonClass}
              onClick={() =>
                void Promise.all([
                  controller.desktop.retryShellState(),
                  controller.workspaces.retry(),
                ])
              }
              disabled={controller.desktop.shellLoading || controller.workspaces.loading}
            >
              Retry
            </button>
          </>
        ) : (
          <p role="status">Loading Howcode…</p>
        )}
      </main>
    )
  }
  return (
    <BuiltInComponentProviders
      settings={controller.desktop.shellState?.appSettings}
      skills={skills}
      workView={
        controller.workspace.state.activeView.startsWith('component:')
          ? (controller.workspace.state.utilityViewReturnState?.activeView ?? 'chat')
          : controller.workspace.state.activeView
      }
    >
      <AppShellLayout controller={controller} />
    </BuiltInComponentProviders>
  )
}
