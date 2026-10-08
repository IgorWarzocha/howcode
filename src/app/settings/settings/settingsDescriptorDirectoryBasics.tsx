import { cn } from '@howaboua/howcode-sdk/utils/cn'
import { settingsInputClass } from '@howcode/ui/classes'
import { FolderCog, FolderPlus } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildDirectoryBasicsSettingsDescriptors({
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
            value={controller.directories.preferredDirectoryLocationDraft}
            onChange={(event) =>
              controller.directories.setPreferredDirectoryLocationDraft(event.target.value)
            }
            onBlur={controller.directories.savePreferredDirectoryLocation}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              controller.directories.savePreferredDirectoryLocation()
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
            value={controller.directories.customPiDirectoryDraft}
            onChange={(event) =>
              controller.directories.setCustomPiDirectoryDraft(event.target.value)
            }
            onBlur={controller.directories.saveCustomPiDirectory}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              controller.directories.saveCustomPiDirectory()
            }}
            className={cn(settingsInputClass, 'w-full pl-9')}
            placeholder={
              controller.directories.resolvedPiDirectory
                ? `Default: ${controller.directories.resolvedPiDirectory} (useful for WSL)`
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
          checked={appSettings.initializeGitOnDirectoryCreate}
          label="Initialise git"
          onClick={controller.directories.toggleInitializeGitOnDirectoryCreate}
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
          checked={appSettings.directoryDashboardEnabled}
          label="Show workspace dashboard"
          onClick={controller.directories.toggleDirectoryDashboardEnabled}
        />
      ),
    },
  ]
}
