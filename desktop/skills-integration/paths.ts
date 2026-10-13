import path from 'node:path'
import type { SkillsPathsHost } from '@howaboua/howcode-skills/inventory'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getAgentDirectory } from '../settings/paths.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'
export const skillsPathsHost: SkillsPathsHost = {
  agentDirectory: getAgentDirectory,
  chatDirectory: () => path.join(getDesktopUserDataPath(), 'chat'),
  agentsSkillsPathsEnabled: () => loadAppSettings().useAgentsSkillsPaths,
}
