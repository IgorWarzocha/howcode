import path from 'node:path'
import { getDesktopWorkingDirectory } from '../../../../shared/desktop-working-directory'
import { DesktopServiceClient } from '../../../desktop-host/desktop-service-client'
import { getDesktopBuildDirectory } from './app-paths'
import type {
  DesktopRuntimeModules,
  PiSkillsModule,
  PiThreadsModule,
  SkillCreatorModule,
  TerminalManagerModule,
} from './desktop-runtime-contracts'

function getProcessEnvironmentVariable(name: string) {
  return process.env[name]
}

function getNodeExecutable() {
  return getProcessEnvironmentVariable('HOWCODE_NODE_PATH')?.trim() || 'node'
}

function getServiceHostPath() {
  return path.join(getDesktopBuildDirectory(), 'service-host.mjs')
}

function proxyModule<T extends Record<string, unknown>>(
  service: DesktopServiceClient,
  moduleName: string,
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
        if (property === 'closeAllTerminals') return service.dispose.bind(service)
        return (...args: unknown[]) => service.invoke(moduleName, String(property), args)
      },
    },
  ) as T
}

export function createDesktopServiceRuntime(): DesktopRuntimeModules {
  const service = new DesktopServiceClient({
    nodeExecutable: getNodeExecutable(),
    serviceHostPath: getServiceHostPath(),
    cwd: getDesktopWorkingDirectory(),
  })
  return {
    piThreads: proxyModule<PiThreadsModule>(service, 'piThreads'),
    piSkills: proxyModule<PiSkillsModule>(service, 'piSkills'),
    skillCreator: proxyModule<SkillCreatorModule>(service, 'skillCreator'),
    terminalManager: proxyModule<TerminalManagerModule>(service, 'terminalManager'),
  }
}
