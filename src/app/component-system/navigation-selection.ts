import { useContext } from 'react'
import { RendererHostsContext } from './installed-renderer-context'

export const classicNavigationRenderer = '@howaboua/howcode-classic-navigation'

export function hasIndependentRendererFeatures(
  contribution: import('@howaboua/howcode-sdk/plugins').PluginRendererContribution,
) {
  return Object.keys(contribution).some((key) => key !== 'navigation' && key !== 'Provider')
}

export function useNavigationRenderer(name: string) {
  return useContext(RendererHostsContext).find(
    (renderer) => renderer.name === name && renderer.contribution.navigation,
  )
}
