import { createRegistry, type RegistryReader } from '@earendil-works/pi-durable'
import { CodingTools } from '@earendil-works/pi-durable/tools'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { CodeArtifactTools } from '../resources/artifacts.ts'
import { Resources } from '../resources/instructions.ts'
import { ChatTools } from '../resources/tools.ts'

/** Statically installed, trusted extensions. Durable owns activation and persisted selection. */
export function createDesktopExtensionRegistry() {
  const registry = createRegistry()
  for (const extension of [CodingTools, ChatTools, CodeArtifactTools, Resources])
    registry.install(extension)
  return registry
}

/** The only compatibility boundary for old UI mode defaults. Explicit lists are exact. */
export function resolveDesktopExtensions(request: ComposerStateRequest, registry: RegistryReader) {
  const names =
    request.composerExtensions ??
    (request.composerMode === 'chat'
      ? [ChatTools.name, Resources.name]
      : [CodingTools.name, CodeArtifactTools.name, Resources.name])
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
