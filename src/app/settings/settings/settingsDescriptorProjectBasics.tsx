import { FolderCog, FolderPlus } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import { settingsInputClass } from '../../ui/classes'
import { cn } from '../../utils/cn'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildProjectBasicsSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    {
      id: 'projects.default-location',
      category: 'howcode',
      title: 'Default workspace location',
      description: 'Default folder for new folder-backed workspaces.',
      keywords: 'workspace folder location path default',
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderPlus
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="text"
            value={controller.projects.preferredProjectLocationDraft}
            onChange={(event) =>
              controller.projects.setPreferredProjectLocationDraft(event.target.value)
            }
            onBlur={controller.projects.savePreferredProjectLocation}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              controller.projects.savePreferredProjectLocation()
            }}
            className={cn(settingsInputClass, 'w-full pl-9')}
            placeholder="Paste an absolute folder path"
            aria-label="Default workspace location"
          />
        </div>
      ),
    },
    {
      id: 'projects.custom-pi-directory',
      category: 'howcode',
      title: 'Custom Pi directory',
      description: 'Override the Pi agent directory used across the app.',
      keywords: 'pi directory agent dir custom path settings sessions models',
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderCog
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="text"
            value={controller.projects.customPiDirectoryDraft}
            onChange={(event) => controller.projects.setCustomPiDirectoryDraft(event.target.value)}
            onBlur={controller.projects.saveCustomPiDirectory}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              controller.projects.saveCustomPiDirectory()
            }}
            className={cn(settingsInputClass, 'w-full pl-9')}
            placeholder={
              controller.projects.resolvedPiDirectory
                ? `Default: ${controller.projects.resolvedPiDirectory} (useful for WSL)`
                : 'Default: ~/.pi/agent (useful for WSL)'
            }
            aria-label="Custom Pi directory"
          />
        </div>
      ),
    },
    {
      id: 'projects.initialize-git',
      category: 'howcode',
      title: 'Initialise git',
      description: 'Always git init when creating a new folder-backed workspace.',
      keywords: 'git init initialize workspaces diffs',
      render: () => (
        <ToggleBox
          checked={appSettings.initializeGitOnProjectCreate}
          label="Initialise git"
          onClick={controller.projects.toggleInitializeGitOnProjectCreate}
        />
      ),
    },
    {
      id: 'projects.dashboard',
      category: 'howcode',
      title: 'Workspace dashboard',
      description: 'Show the dashboard when a folder-backed workspace is selected.',
      keywords: 'workspace dashboard overview code landing performance disable',
      render: () => (
        <ToggleBox
          checked={appSettings.projectDashboardEnabled}
          label="Show workspace dashboard"
          onClick={controller.projects.toggleProjectDashboardEnabled}
        />
      ),
    },
  ]
}
