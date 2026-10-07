import { join } from 'node:path'
import { createRegistry, type Harness, type RegistryReader } from '@earendil-works/pi-durable'
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node'
import { createNodeShellBackend, createNotebookMode } from '@howaboua/pi-durable-notebook'
import { createAgentResources } from '../../components/agent-resources/service/index.ts'
import { artifactTools, CodeArtifactTools } from '../../components/artifacts/service/extension.ts'
import { createChatTools } from '../../components/chat-tools/service/index.ts'
import { CodingTools } from '../../components/coding/service/extension.ts'
import { getComposerSkills } from '../../components/skills/service/extension.ts'
import type { ComposerStateRequest } from '../../shared/desktop-contracts.ts'
import { getDesktopUserDataPath } from '../user-data-path.ts'

const resources = createAgentResources(getComposerSkills)
const Resources = resources.extension
const environmentId = new NodeExecutionEnv({ cwd: process.cwd() }).id
let harness: Harness | undefined
const notebook = createNotebookMode({
  stateDirectory: join(getDesktopUserDataPath(), 'notebook'),
  native: { environmentId },
  shell: { backend: createNodeShellBackend({ environmentId }) },
  cancelTask: (id, context) => {
    if (!harness) throw new Error('Notebook runtime is not bound.')
    return harness.abortTask(id, context)
  },
})
const Notebook = notebook.extension
export const disposeDesktopExtensions = () => notebook.close()
export function bindDesktopExtensions(runtime: Harness) {
  notebook.bind(runtime)
  harness = runtime
}
const ChatTools = createChatTools({
  artifactTools,
  discoverSkills: () => getComposerSkills({ composerMode: 'chat' }),
  skillsSection: resources.createSkillsSection('chat'),
})

/** Statically installed, trusted extensions. Durable owns activation and persisted selection. */
export function createDesktopExtensionRegistry() {
  const registry = createRegistry()
  for (const extension of [CodingTools, ChatTools, CodeArtifactTools, Resources, Notebook])
    registry.install(extension)
  return registry
}

/** The only compatibility boundary for old UI mode defaults. Explicit lists are exact. */
export function resolveDesktopExtensions(request: ComposerStateRequest, registry: RegistryReader) {
  const names =
    request.composerExtensions ??
    (request.composerMode === 'chat'
      ? [ChatTools.name, Resources.name, Notebook.name]
      : [CodingTools.name, CodeArtifactTools.name, Resources.name, Notebook.name])
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
