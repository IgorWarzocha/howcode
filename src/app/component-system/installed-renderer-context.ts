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
export function useArtifactRenderers() {
  return useContext(RendererHostsContext).filter(({ contribution }) => contribution.artifacts)
}

export function componentView(name: string): import('../types').ComponentView {
  return `component:${name}`
}

/** Skills already has persisted shell URLs and directory-scope return state. */
export function installedPageView(name: string): import('../types').View {
  return name === '@howaboua/howcode-skills' ? 'skills' : componentView(name)
}

export function useInstalledPageViews() {
  return useContext(RendererHostsContext).flatMap((renderer) =>
    renderer.contribution.sidebarView
      ? [
          {
            ...renderer,
            id: installedPageView(renderer.name),
            view: renderer.contribution.sidebarView,
          },
        ]
      : [],
  )
}
