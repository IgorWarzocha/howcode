import * as Schema from 'effect/Schema'

/** Built-in application capabilities. These IDs do not select Durable agent tools. */
export const toolkitExtensions = [
  { id: 'coding', label: 'Coding', description: 'Projects, workspaces, and Git operations.' },
  { id: 'terminal', label: 'Terminal', description: 'Interactive workspace terminals.' },
  {
    id: 'artifacts',
    label: 'Artifacts',
    description: 'Conversation artifact previews and editing.',
  },
  { id: 'skills', label: 'Skills', description: 'Skill browsing and management.' },
  { id: 'dictation', label: 'Dictation', description: 'Voice input for composers.' },
] as const

export type ToolkitExtensionId = (typeof toolkitExtensions)[number]['id']

export const ToolkitExtensionIdSchema = Schema.Literals(
  toolkitExtensions.map((extension) => extension.id),
)

export const EnabledToolkitExtensionsSchema = Schema.mutable(Schema.Array(ToolkitExtensionIdSchema))

export type ToolkitExtensionSettings = {
  enabledToolkitExtensions?: readonly ToolkitExtensionId[] | undefined
}

/** Missing settings preserve existing installs; an explicit empty list disables all. */
export function isToolkitExtensionEnabled(
  settings: ToolkitExtensionSettings | null | undefined,
  id: ToolkitExtensionId,
) {
  return (
    settings?.enabledToolkitExtensions === undefined ||
    settings.enabledToolkitExtensions.includes(id)
  )
}
