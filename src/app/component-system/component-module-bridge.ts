import * as gitRenderer from '@howaboua/howcode-sdk/git-renderer'
import * as installedPlugins from '@howaboua/howcode-sdk/installed-plugins'
import * as navigation from '@howaboua/howcode-sdk/navigation'
import * as outputs from '@howaboua/howcode-sdk/outputs'
import * as sidebarRenderer from '@howaboua/howcode-sdk/sidebar-renderer'
import * as workspaceSurfaces from '@howaboua/howcode-sdk/workspace-surfaces'
import * as reactQuery from '@tanstack/react-query'
import * as react from 'react'
import * as jsxDevRuntime from 'react/jsx-dev-runtime'
import * as jsxRuntime from 'react/jsx-runtime'
import * as reactDom from 'react-dom'
import * as reactDomClient from 'react-dom/client'
import {
  componentModuleBridgeKey,
  type componentSharedModules,
} from '../../../shared/installed-component-contracts'
import { RendererPortalScope, RendererRetainedWorkspaceSurface } from './renderer-style-scope'

/** Keep renderer CSS ownership when its DOM moves outside a slot. */
const createRendererPortal: typeof reactDom.createPortal = (children, container, key) =>
  reactDom.createPortal(
    react.createElement(RendererPortalScope, { children, container }),
    container,
    key,
  )

const rendererReactDom = { ...reactDom, createPortal: createRendererPortal }

const modules = {
  react,
  'react-dom': { ...rendererReactDom, default: rendererReactDom },
  'react-dom/client': reactDomClient,
  'react/jsx-runtime': jsxRuntime,
  'react/jsx-dev-runtime': jsxDevRuntime,
  '@tanstack/react-query': reactQuery,
  '@howaboua/howcode-sdk/installed-plugins': installedPlugins,
  '@howaboua/howcode-sdk/git-renderer': gitRenderer,
  '@howaboua/howcode-sdk/sidebar-renderer': sidebarRenderer,
  '@howaboua/howcode-sdk/navigation': navigation,
  '@howaboua/howcode-sdk/outputs': outputs,
  '@howaboua/howcode-sdk/workspace-surfaces': {
    ...workspaceSurfaces,
    RetainedWorkspaceSurface: RendererRetainedWorkspaceSurface,
  },
} satisfies Record<(typeof componentSharedModules)[number], object>

export function installComponentModuleBridge() {
  Object.defineProperty(globalThis, componentModuleBridgeKey, {
    value: modules,
    configurable: true,
  })
}
