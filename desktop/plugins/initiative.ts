import type { PluginInitiativeConfiguration } from '@howaboua/howcode-sdk/initiative-configuration'
import { resolveInstalledInitiativeConfiguration } from './runtime.ts'

export function createPluginInitiativeConfiguration(): PluginInitiativeConfiguration {
  const current = () => {
    const initiative = resolveInstalledInitiativeConfiguration()
    if (!initiative) throw new Error('Initiative is unavailable. Install and activate Initiative.')
    return initiative
  }
  return {
    configure: (input) => current().configure(input),
    inspect: (input) => current().inspect(input),
  }
}
