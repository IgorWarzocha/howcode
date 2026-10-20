import { createRegistry, type Extension, type RegistryReader } from '@earendil-works/pi-durable'
import { CodingTools } from '@earendil-works/pi-durable/tools'
import { createAgentResources } from '../../components/agent-resources/service/index.ts'
import { createAttachmentTools } from '../../components/attachment-tools/service/index.ts'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { installedDefaultExtensionExclusions } from '../plugins/runtime.ts'
import { getComposerSkills } from '../skills-integration/composer.ts'
import { AppControlTools } from './app-control-tool.ts'
import { installedAgentExtensions } from './plugin-agent-tools.ts'

const Resources = createAgentResources(getComposerSkills)
const AttachmentTools = createAttachmentTools({
  discoverSkills: (agent) =>
    getComposerSkills({
      directoryId: agent.cwd,
      composerExtensions: agent.extensions.map((extension) => extension.name),
    }),
})

/** Durable owns activation and persisted selection. */
export function createDesktopExtensionRegistry(
  packages: readonly Extension[] = [],
  host: readonly Extension[] = [],
) {
  const registry = createRegistry()
  for (const extension of [
    CodingTools,
    AttachmentTools,
    Resources,
    AppControlTools,
    ...installedAgentExtensions(),
    ...host,
    ...packages,
  ]) {
    if (registry.snapshot().extension(extension.name))
      throw new Error(`Duplicate installed extension: ${extension.name}`)
    registry.install(extension)
  }
  return registry
}

/** Selection is independent of directories and presentation. Explicit lists are exact. */
export function resolveDesktopExtensions(request: ComposerStateRequest, registry: RegistryReader) {
  const excluded = new Set(defaultExtensionExclusions().map((extension) => extension.name))
  const names =
    request.composerExtensions ??
    registry
      .snapshot()
      .installed()
      .filter((extension) => !excluded.has(extension.name))
      .map((extension) => extension.name)
  const snapshot = registry.snapshot()
  const seen = new Set<string>()
  const tools = new Map<string, string>()
  const extensions = names.map((name) => {
    if (seen.has(name)) throw new Error(`Duplicate conversation extension: ${name}`)
    seen.add(name)
    const extension = snapshot.extension(name)
    if (!extension) throw new Error(`Unknown conversation extension: ${name}`)
    for (const tool of extension.tools ?? []) {
      const owner = tools.get(tool.name)
      if (owner) throw new Error(`Tool ${tool.name} is provided by both ${owner} and ${name}.`)
      tools.set(tool.name, name)
    }
    return extension
  })
  return { extensions }
}

/** Default conversations follow live host packages. Explicit choices stay exact. */
export function defaultExtensionExclusions(): Extension[] {
  return [AttachmentTools, AppControlTools, ...installedDefaultExtensionExclusions()]
}
