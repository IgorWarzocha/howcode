import { createRegistry, type Extension, type RegistryReader } from '@earendil-works/pi-durable'
import { CodingTools } from '@earendil-works/pi-durable/tools'
import { createAgentResources } from '../../components/agent-resources/service/index.ts'
import { artifactTools, CodeArtifactTools } from '../../components/artifacts/service/extension.ts'
import { createChatTools } from '../../components/chat-tools/service/index.ts'
import { getComposerSkills } from '../../components/skills/service/extension.ts'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { installedAgentExtensions } from './plugin-agent-tools.ts'
import { WorkspaceLayoutTools } from './workspace-layout-tool.ts'

const resources = createAgentResources(getComposerSkills)
const Resources = resources.extension
const ChatTools = createChatTools({
  artifactTools,
  discoverSkills: () => getComposerSkills({ composerProfile: 'general' }),
  skillsSection: resources.createSkillsSection('chat'),
})

/** Durable owns activation and persisted selection. */
export function createDesktopExtensionRegistry(
  packages: readonly Extension[] = [],
  host: readonly Extension[] = [],
) {
  const registry = createRegistry()
  for (const extension of [
    CodingTools,
    ChatTools,
    CodeArtifactTools,
    Resources,
    WorkspaceLayoutTools,
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

/** The only compatibility boundary for old UI mode defaults. Explicit lists are exact. */
export function resolveDesktopExtensions(request: ComposerStateRequest, registry: RegistryReader) {
  const excluded = new Set(defaultExtensionExclusions(request).map((extension) => extension.name))
  const names =
    request.composerExtensions ??
    registry
      .snapshot()
      .installed()
      .filter((extension) => !excluded.has(extension.name))
      .map((extension) => extension.name)
  const snapshot = registry.snapshot()
  const seen = new Set<string>()
  const extensions = names.map((name) => {
    if (seen.has(name)) throw new Error(`Duplicate conversation extension: ${name}`)
    seen.add(name)
    const extension = snapshot.extension(name)
    if (!extension) throw new Error(`Unknown conversation extension: ${name}`)
    return extension
  })
  return { extensions }
}

/** Default conversations follow live host packages. Explicit choices stay exact. */
export function defaultExtensionExclusions(request: ComposerStateRequest): Extension[] {
  return request.composerProfile === 'general' ? [CodingTools, CodeArtifactTools] : [ChatTools]
}
