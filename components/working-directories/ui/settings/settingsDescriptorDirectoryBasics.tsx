import { Checkbox, Input } from '@howaboua/howcode-sdk/ui/controls'
import type { AppSettings } from '@howcode/desktop/types'
import type { SettingDescriptor } from '@howcode/settings/settingsTypes'
import { FolderPlus } from 'lucide-react'
import type { DirectorySettingsController } from './useDirectorySettingsController'

type SettingsController = { directories: DirectorySettingsController }

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
      category: 'general',
      section: 'Workspaces',
      title: 'Default workspace location',
      description: 'Default folder for new folder-backed workspaces.',
      keywords: 'workspace folder location path default',
      render: () => (
        <div className="relative w-[22rem] max-w-full">
          <FolderPlus
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <Input
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
            className="w-full pl-9"
            placeholder="Paste an absolute folder path"
            aria-label="Default workspace location"
          />
        </div>
      ),
    },
    {
      id: 'projects.initialize-git',
      category: 'general',
      section: 'Workspaces',
      title: 'Initialise git',
      description: 'Always git init when creating a new folder-backed workspace.',
      keywords: 'git init initialize workspaces diffs',
      render: () => (
        <Checkbox
          checked={appSettings.initializeGitOnDirectoryCreate}
          aria-label="Initialise git"
          onChange={controller.directories.toggleInitializeGitOnDirectoryCreate}
        />
      ),
    },
    {
      id: 'projects.dashboard',
      category: 'general',
      section: 'Workspaces',
      title: 'Workspace dashboard',
      description: 'Show the dashboard when a folder-backed workspace is selected.',
      keywords: 'workspace dashboard overview code landing performance disable',
      render: () => (
        <Checkbox
          checked={appSettings.directoryDashboardEnabled}
          aria-label="Show workspace dashboard"
          onChange={controller.directories.toggleDirectoryDashboardEnabled}
        />
      ),
    },
  ]
}
