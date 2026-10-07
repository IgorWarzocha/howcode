import path from 'node:path'
import type {
  DesktopServiceRuntime,
  PiSkillsService,
  PiThreadsService,
} from '../../shared/desktop-service-contracts'
import {
  type DesktopServiceRemoteModuleName,
  desktopServiceRemoteMethods,
} from '../../shared/desktop-service-rpc'
import { DesktopServiceClient } from '../desktop-host/desktop-service-client'

function proxyModule<T extends Record<string, unknown>>(
  service: DesktopServiceClient,
  moduleName: DesktopServiceRemoteModuleName,
) {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'subscribeDesktopEvents')
          return service.subscribeDesktopEvents.bind(service)
        if (property === 'disposeDesktopRuntime') return service.dispose.bind(service)
        if (
          typeof property !== 'string' ||
          !Object.hasOwn(desktopServiceRemoteMethods[moduleName], property)
        )
          return undefined
        return (...args: unknown[]) => service.invokeDynamic(moduleName, property, args)
      },
    },
  ) as T
}

export function createServerRuntime(
  root: string,
  buildRoot = path.join(root, 'build'),
): DesktopServiceRuntime & { dispose: () => Promise<void> } {
  const service = new DesktopServiceClient({
    nodeExecutable: process.execPath,
    serviceHostPath: path.join(buildRoot, 'desktop', 'service-host.mjs'),
    cwd: root,
    env: {
      HOWCODE_REPO_ROOT: root,
      HOWCODE_BUNDLED_SKILLS_PATH: path.join(buildRoot, 'resources', 'skills'),
    },
  })
  return {
    dispose: () => service.dispose(),
    piThreads: proxyModule<PiThreadsService>(service, 'piThreads'),
    piSkills: proxyModule<PiSkillsService>(service, 'piSkills'),
    terminalManager: service.terminalManager,
  }
}
