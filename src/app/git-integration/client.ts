import { createGitClient } from '@howaboua/howcode-git/ui'
import { installedRendererContributions } from '../component-system/installed-renderers.generated'

export const gitClient = createGitClient(() =>
  Object.hasOwn(installedRendererContributions, '@howaboua/howcode-git')
    ? window.piDesktop
    : undefined,
)
export const {
  getDirectoryGitStateQuery,
  getDirectoryDiffStatsQuery,
  getDirectoryDiffImagePreviewQuery,
  getDirectoryDiffFileContentsQuery,
  listDirectoryCommitsQuery,
  startDirectoryDiffStreamQuery,
  cancelDirectoryDiffStreamQuery,
  canStartDirectoryDiffStreamQuery,
} = gitClient
