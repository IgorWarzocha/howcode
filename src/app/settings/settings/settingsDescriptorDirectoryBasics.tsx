import { Checkbox, Input } from '@howaboua/howcode-sdk/ui/controls'
import { FolderCog, FolderPlus } from 'lucide-react'
import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import type { SettingDescriptor } from './settingsTypes'

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
          <Input
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
            className="w-full pl-9"
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
        <Checkbox
          checked={appSettings.initializeGitOnDirectoryCreate}
          aria-label="Initialise git"
          onChange={controller.directories.toggleInitializeGitOnDirectoryCreate}
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
        <Checkbox
          checked={appSettings.directoryDashboardEnabled}
          aria-label="Show workspace dashboard"
          onChange={controller.directories.toggleDirectoryDashboardEnabled}
        />
      ),
    },
  ]
}
