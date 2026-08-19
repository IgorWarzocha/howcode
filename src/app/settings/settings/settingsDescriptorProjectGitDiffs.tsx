import type { AppSettings } from '../../desktop/types'
import type { SettingsController } from './settingsDescriptorTypes'
import { SettingsSegmentedControl } from './settingsSegmentedControl'
import type { SettingDescriptor } from './settingsTypes'
import { ToggleBox } from './settingsUi'

export function buildGitDiffSettingsDescriptors({
  appSettings,
  controller,
}: {
  appSettings: AppSettings
  controller: SettingsController
}): SettingDescriptor[] {
  return [
    {
      id: 'projects.gitops-default',
      category: 'git-diffs',
      title: 'GitOps default',
      description: 'Default global commit action.',
      keywords: 'gitops commit push default project',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-2"
          value={appSettings.gitOpsDefaultMode}
          options={[
            { value: 'commit', label: 'Commit' },
            { value: 'commit-push', label: 'Commit & push' },
          ]}
          onChange={controller.projects.setGitOpsDefaultMode}
        />
      ),
    },
    {
      id: 'projects.git-diff-baseline-default',
      category: 'git-diffs',
      title: 'Diff comparison default',
      description: 'Default baseline setting for git summary.',
      keywords: 'git diff baseline comparison files lines default',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-4"
          className="gap-1"
          value={appSettings.gitDiffBaselineDefault.kind}
          options={[
            { value: 'head', label: 'Last' },
            { value: 'previous', label: 'Prev' },
            { value: 'dev-branch', label: 'Dev' },
            { value: 'main-branch', label: 'Default' },
          ]}
          onChange={(kind) => controller.projects.setGitDiffBaselineDefault({ kind })}
        />
      ),
    },
    {
      id: 'projects.git-diff-render-default',
      category: 'git-diffs',
      title: 'Diff view default',
      description: 'Default layout for the GitOps diff panel.',
      keywords: 'git diff layout stacked split default',
      render: () => (
        <SettingsSegmentedControl
          columnsClassName="grid-cols-2"
          value={appSettings.gitDiffRenderModeDefault}
          options={[
            { value: 'stacked', label: 'Unified' },
            { value: 'split', label: 'Split' },
          ]}
          onChange={controller.projects.setGitDiffRenderModeDefault}
        />
      ),
    },
    {
      id: 'projects.git-diff-file-tree-default',
      category: 'git-diffs',
      title: 'Diff file tree',
      description: 'Default visibility for the GitOps file tree.',
      keywords: 'git diff file tree changed files sidebar default',
      render: () => (
        <ToggleBox
          checked={appSettings.gitDiffFileTreeDefaultVisible}
          label="Show file tree"
          onClick={() =>
            controller.projects.setGitDiffFileTreeDefaultVisible(
              !appSettings.gitDiffFileTreeDefaultVisible,
            )
          }
        />
      ),
    },
    {
      id: 'projects.git-diff-untracked-default',
      category: 'git-diffs',
      title: 'Untracked files',
      description: 'Include untracked files in GitOps diffs by default.',
      keywords: 'git diff untracked files default gitops',
      render: () => (
        <ToggleBox
          checked={appSettings.gitDiffIncludeUntrackedDefault}
          label="Include untracked"
          onClick={() =>
            controller.projects.setGitDiffIncludeUntrackedDefault(
              !appSettings.gitDiffIncludeUntrackedDefault,
            )
          }
        />
      ),
    },
  ]
}
