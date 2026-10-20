import path from 'node:path'
import { type DesktopLaunch, desktopLaunchEnvironmentKey } from '../../shared/desktop-launch'
import type {
  AppService,
  DesktopServiceRuntime,
  PiSkillsService,
  PluginService,
  WorkingDirectoriesService,
} from '../../shared/desktop-service-contracts'
import {
  type DesktopServiceRemoteModuleName,
  desktopServiceRemoteMethods,
} from '../../shared/desktop-service-rpc'
import type { DevRuntimeService } from '../../shared/dev-runtime'
import type { PackageUiService } from '../../shared/package-ui-contracts'
import { DesktopServiceClient } from '../desktop-host/desktop-service-client'
import type { HeadlessServerOptions } from './options'

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
  launchOptions?: Pick<HeadlessServerOptions, 'host' | 'port'>,
): DesktopServiceRuntime & {
  start: () => Promise<void>
  dispose: () => Promise<void>
  dev: DevRuntimeService
} {
  const { HOWCODE_RENDERER_ROOT: rendererRoot } = process.env
  const launch: DesktopLaunch = {
    executable: process.execPath,
    args: [
      path.join(buildRoot, 'server', 'index.mjs'),
      '--host',
      launchOptions?.host ?? '127.0.0.1',
      '--port',
      String(launchOptions?.port ?? 5173),
    ],
    cwd: root,
    environment: {
      HOWCODE_REPO_ROOT: root,
      HOWCODE_RENDERER_ROOT: rendererRoot ? path.resolve(rendererRoot) : path.join(root, 'dist'),
    },
  }
  const service = new DesktopServiceClient({
    nodeExecutable: process.execPath,
    serviceHostPath: path.join(buildRoot, 'desktop', 'service-host.mjs'),
    cwd: root,
    env: {
      HOWCODE_REPO_ROOT: root,
      HOWCODE_BUNDLED_SKILLS_PATH: path.join(buildRoot, 'resources', 'skills'),
      [desktopLaunchEnvironmentKey]: JSON.stringify(launch),
    },
  })
  return {
    start: () => service.start(),
    dev: proxyModule<DevRuntimeService>(service, 'dev'),
    dispose: () => service.dispose(),
    app: proxyModule<AppService>(service, 'app'),
    packages: proxyModule<PackageUiService>(service, 'packages'),
    skills: proxyModule<PiSkillsService>(service, 'skills'),
    plugins: proxyModule<PluginService>(service, 'plugins'),
    workingDirectories: proxyModule<WorkingDirectoriesService>(service, 'workingDirectories'),
    terminalManager: service.terminalManager,
  }
}
