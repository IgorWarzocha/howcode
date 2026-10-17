import type { SkillsPathsHost } from '@howaboua/howcode-skills/inventory'
import { loadAppSettings } from '../app-settings/readers.ts'
import { getAgentDirectory } from '../settings/paths.ts'
export const skillsPathsHost: SkillsPathsHost = {
  agentDirectory: getAgentDirectory,
  agentsSkillsPathsEnabled: () => loadAppSettings().useAgentsSkillsPaths,
}
