import path from 'node:path'
import type {
  DesktopServiceRuntime,
  PiSkillsService,
  PiThreadsService,
  SkillCreatorService,
  TerminalService,
} from '../../../../shared/desktop-service-contracts'
import { getDesktopWorkingDirectory } from '../../../../shared/desktop-working-directory'
import { DesktopServiceClient } from '../../../desktop-host/desktop-service-client'
import { getSystemNodeExecutable } from '../../../desktop-host/node-discovery'
import { getDesktopBuildDirectory } from './app-paths'

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
  const resourcesPath = getElectronResourcesPath()
  return resourcesPath ? path.join(resourcesPath, 'resources', 'skills') : ''
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
        if (property === 'subscribeTerminalEvents')
          return service.subscribeTerminalEvents.bind(service)
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
    skillCreator: proxyModule<SkillCreatorService>(service, 'skillCreator'),
    terminalManager: proxyModule<TerminalService>(service, 'terminalManager'),
  }
}
