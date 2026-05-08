import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { app } from 'electron'
import type { Project } from '../../../../../shared/desktop-contracts'
import type { DesktopRequestHandlerMap } from '../../../../../shared/desktop-ipc'
import { getDesktopWorkingDirectory } from '../../../../../shared/desktop-working-directory'
import type { HowcodeInstanceManifest } from '../../../../../shared/howcode-server-contracts'
import type { PiThreadsModule } from '../../runtime/desktop-runtime-contracts'

type InstanceManifestHandlers = Pick<DesktopRequestHandlerMap, 'getHowcodeInstanceManifest'>

type InstanceIdentity = {
  instanceId: string
}

function getIdentityPath() {
  return path.join(app.getPath('userData'), 'howcode-instance.json')
}

async function getInstanceId() {
  const identityPath = getIdentityPath()
  const identity = (await import('node:fs/promises')
    .then((fs) => fs.readFile(identityPath, 'utf8'))
    .then((content) => JSON.parse(content) as InstanceIdentity)
    .catch(() => null)) as InstanceIdentity | null
  if (identity?.instanceId) return identity.instanceId

  const instanceId = randomUUID()
  await import('node:fs/promises').then(async (fs) => {
    await fs.mkdir(path.dirname(identityPath), { recursive: true })
    await fs.writeFile(identityPath, `${JSON.stringify({ instanceId }, null, 2)}\n`)
  })
  return instanceId
}

function getFallbackInstanceId() {
  return `howcode:${createHash('sha256').update(app.getPath('userData')).digest('hex').slice(0, 16)}`
}

function mapProject(project: Project) {
  return {
    id: project.resolvedId ?? project.id,
    latestModifiedMs: project.latestModifiedMs ?? null,
    name: project.name,
    repoOriginUrl: project.repoOriginUrl ?? null,
    threadCount: project.threadCount ?? project.threads.length,
  }
}

export function createInstanceManifestHandlers(
  piThreads: PiThreadsModule,
  getServerUrl: () => string | null = () => null,
): InstanceManifestHandlers {
  return {
    getHowcodeInstanceManifest: async (): Promise<HowcodeInstanceManifest> => {
      const shellState = await piThreads.loadShellState(getDesktopWorkingDirectory())
      const instanceId = await getInstanceId().catch(getFallbackInstanceId)
      return {
        instanceId,
        instanceName: app.getName() || 'Howcode',
        projects: shellState.projects.map(mapProject),
        serverUrl: getServerUrl(),
      }
    },
  }
}
