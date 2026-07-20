import path from 'node:path'
import { app } from 'electron'
import type {
  DesktopServiceRuntime,
  PiSkillsService,
  PiThreadsService,
} from '../../../../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../../../../shared/desktop-working-directory'
import { DesktopServiceClient } from '../../../desktop-host/desktop-service-client'
import { getSystemNodeExecutable } from '../../../desktop-host/node-discovery'
import { getAppRootPath, getDesktopBuildDirectory } from './app-paths'

function getServiceHostPath() {
  return path.join(getDesktopBuildDirectory(), 'service-host.mjs')
}

function getElectronResourcesPath() {
  const processWithResourcesPath = process as NodeJS.Process & {
    resourcesPath?: string | undefined
  }
  return (
    // biome-ignore lint/complexity/useLiteralKeys: process.env is typed with an index signature.
    process.env['HOWCODE_ELECTRON_RESOURCES_PATH']?.trim() ||
    processWithResourcesPath.resourcesPath ||
    ''
  )
}

function getBundledSkillsPath() {
  return app.isPackaged
    ? path.join(getElectronResourcesPath(), 'resources', 'skills')
    : path.join(getAppRootPath(), 'desktop', 'resources', 'skills')
}

function proxyModule<T extends Record<string, unknown>>(
  service: DesktopServiceClient,
  moduleName: keyof DesktopServiceRuntime,
) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'subscribeDesktopEvents')
          return service.subscribeDesktopEvents.bind(service)
        if (property === 'disposeDesktopRuntime') return service.dispose.bind(service)
        return (...args: unknown[]) => service.invokeDynamic(moduleName, String(property), args)
      },
    },
  ) as T
}

export function createDesktopServiceRuntime(): DesktopServiceRuntime {
  const service = new DesktopServiceClient({
    nodeExecutable: getSystemNodeExecutable,
    serviceHostPath: getServiceHostPath(),
    cwd: getDesktopWorkingDirectory(),
    env: {
      HOWCODE_ELECTRON_RESOURCES_PATH: getElectronResourcesPath(),
      HOWCODE_BUNDLED_SKILLS_PATH: getBundledSkillsPath(),
    },
  })
  return {
    piThreads: proxyModule<PiThreadsService>(service, 'piThreads'),
    piSkills: proxyModule<PiSkillsService>(service, 'piSkills'),
    terminalManager: service.terminalManager,
  }
}
