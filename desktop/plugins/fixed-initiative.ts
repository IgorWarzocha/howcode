import type { FixedInitiative } from '@howaboua/howcode-sdk/fixed-initiative'
import { resolveInstalledFixedInitiative } from './runtime.ts'

export function createPluginFixedInitiative(): FixedInitiative {
  return {
    inspect: () => {
      const initiative = resolveInstalledFixedInitiative()
      if (!initiative)
        throw new Error('Fixed initiative is unavailable. Install and activate Pulses.')
      return initiative.inspect()
    },
  }
}
