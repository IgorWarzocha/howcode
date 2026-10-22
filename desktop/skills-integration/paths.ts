import os from 'node:os'
import path from 'node:path'
import type { SkillsPathsHost } from '@howaboua/howcode-sdk/skills-host'
import { skillSourceCatalog } from '@howaboua/howcode-skills/source-catalog'
import {
  readLegacyUseAgentsSkillsPaths,
  readSkillsPreferencesJson,
} from '../app-settings/readers.ts'
import { writeSkillsPreferencesJson } from '../app-settings/writers.ts'
import { getAgentDirectory } from '../settings/paths.ts'

export const skillsPathsHost: SkillsPathsHost = {
  sources: () => {
    const home = os.homedir()
    const { XDG_CONFIG_HOME } = process.env
    const configured = XDG_CONFIG_HOME?.trim()
    // XDG configuration paths must be absolute; relative values use the standard default.
    const config =
      configured && path.isAbsolute(configured) ? configured : path.join(home, '.config')
    const bases = { home, agent: getAgentDirectory(), config }
    return skillSourceCatalog.map((source) => ({
      id: source.id,
      label: source.label,
      scope: source.scope,
      path:
        source.base === 'directory' ? source.path : path.resolve(bases[source.base], source.path),
    }))
  },
  readPreferences: readSkillsPreferencesJson,
  writePreferences: writeSkillsPreferencesJson,
  legacyInstallSourceIds: () =>
    readLegacyUseAgentsSkillsPaths()
      ? { user: 'agents-user', directory: 'agents-directory' }
      : { user: 'pi-user', directory: 'pi-directory' },
}
