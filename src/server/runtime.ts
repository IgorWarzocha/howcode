import path from 'node:path'
import type {
  AppService,
  ArtifactsService,
  CodingService,
  DesktopServiceRuntime,
  DictationService,
  PiSkillsService,
} from '../../shared/desktop-service-contracts'
import {
  type DesktopServiceRemoteModuleName,
  desktopServiceRemoteMethods,
} from '../../shared/desktop-service-rpc'
import type { PackageUiService } from '../../shared/package-ui-contracts'
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
    app: proxyModule<AppService>(service, 'app'),
    packages: proxyModule<PackageUiService>(service, 'packages'),
    skills: proxyModule<PiSkillsService>(service, 'skills'),
    coding: proxyModule<CodingService>(service, 'coding'),
    artifacts: proxyModule<ArtifactsService>(service, 'artifacts'),
    dictation: proxyModule<DictationService>(service, 'dictation'),
    terminalManager: service.terminalManager,
  }
}
