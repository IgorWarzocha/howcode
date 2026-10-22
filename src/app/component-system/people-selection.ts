import { getInstalledRendererContributions } from './installed-component-catalog'

/** Resolve the admitted feature at action time, independently of shell component ancestry. */
export function selectedInstalledPersonId() {
  const providers = Object.values(getInstalledRendererContributions()).flatMap((contribution) =>
    contribution.people ? [contribution.people] : [],
  )
  if (providers.length > 1) throw new Error('Conflicting component People providers.')
  return providers[0]?.selectedPersonId()
}
