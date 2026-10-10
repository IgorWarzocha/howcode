import * as installedPlugins from '@howaboua/howcode-sdk/installed-plugins'
import * as outputs from '@howaboua/howcode-sdk/outputs'
import * as workspaceSurfaces from '@howaboua/howcode-sdk/workspace-surfaces'
import * as react from 'react'
import * as jsxDevRuntime from 'react/jsx-dev-runtime'
import * as jsxRuntime from 'react/jsx-runtime'
import * as reactDom from 'react-dom'
import * as reactDomClient from 'react-dom/client'
import {
  componentModuleBridgeKey,
  type componentSharedModules,
} from '../../../shared/installed-component-contracts'

const modules = {
  react,
  'react-dom': reactDom,
  'react-dom/client': reactDomClient,
  'react/jsx-runtime': jsxRuntime,
  'react/jsx-dev-runtime': jsxDevRuntime,
  '@howaboua/howcode-sdk/installed-plugins': installedPlugins,
  '@howaboua/howcode-sdk/outputs': outputs,
  '@howaboua/howcode-sdk/workspace-surfaces': workspaceSurfaces,
} satisfies Record<(typeof componentSharedModules)[number], object>

export function installComponentModuleBridge() {
  Object.defineProperty(globalThis, componentModuleBridgeKey, {
    value: modules,
    configurable: true,
  })
}
