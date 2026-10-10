import type { PluginRendererContribution, PluginRendererHost } from '@howaboua/howcode-sdk/plugins'
import { createContext, useContext } from 'react'
import type { PackageUiReference } from '../../../shared/package-ui-contracts'

export type Renderer = {
  name: string
  contribution: PluginRendererContribution
  host: PluginRendererHost
  reference?: PackageUiReference
}
export const RendererHostsContext = createContext<Renderer[]>([])
export function componentView(name: string): import('../types').ComponentView {
  return `component:${name}`
}

export function useInstalledPageViews() {
  return useContext(RendererHostsContext).flatMap((renderer) =>
    renderer.contribution.sidebarView
      ? [{ ...renderer, id: componentView(renderer.name), view: renderer.contribution.sidebarView }]
      : [],
  )
}
