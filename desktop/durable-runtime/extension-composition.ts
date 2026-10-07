import { createRegistry, type Extension, type RegistryReader } from '@earendil-works/pi-durable'
import { createAgentResources } from '../../components/agent-resources/service/index.ts'
import { artifactTools, CodeArtifactTools } from '../../components/artifacts/service/extension.ts'
import { createChatTools } from '../../components/chat-tools/service/index.ts'
import { CodingTools } from '../../components/coding/service/extension.ts'
import { getComposerSkills } from '../../components/skills/service/extension.ts'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'

const resources = createAgentResources(getComposerSkills)
const Resources = resources.extension
const ChatTools = createChatTools({
  artifactTools,
  discoverSkills: () => getComposerSkills({ composerMode: 'chat' }),
  skillsSection: resources.createSkillsSection('chat'),
})

/** Durable owns activation and persisted selection. */
export function createDesktopExtensionRegistry(packages: readonly Extension[] = []) {
  const registry = createRegistry()
  for (const extension of [CodingTools, ChatTools, CodeArtifactTools, Resources, ...packages]) {
    if (registry.snapshot().extension(extension.name))
      throw new Error(`Duplicate installed extension: ${extension.name}`)
    registry.install(extension)
  }
  return registry
}

/** The only compatibility boundary for old UI mode defaults. Explicit lists are exact. */
export function resolveDesktopExtensions(request: ComposerStateRequest, registry: RegistryReader) {
  const builtins = new Set([
    ChatTools.name,
    CodingTools.name,
    CodeArtifactTools.name,
    Resources.name,
  ])
  const packages = registry
    .snapshot()
    .installed()
    .filter((extension) => !builtins.has(extension.name))
  const names =
    request.composerExtensions ??
    (request.composerMode === 'chat'
      ? [ChatTools.name, Resources.name, ...packages.map((extension) => extension.name)]
      : [
          CodingTools.name,
          CodeArtifactTools.name,
          Resources.name,
          ...packages.map((extension) => extension.name),
        ])
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
