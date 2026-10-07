import * as Schema from 'effect/Schema'

/** Built-in application capabilities. These IDs do not select Durable agent tools. */
export const toolkitComponents = [
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

export type ToolkitComponentId = (typeof toolkitComponents)[number]['id']

export const ToolkitComponentIdSchema = Schema.Literals(
  toolkitComponents.map((component) => component.id),
)

export const EnabledToolkitComponentsSchema = Schema.mutable(Schema.Array(ToolkitComponentIdSchema))

export type ToolkitComponentSettings = {
  enabledToolkitComponents?: readonly ToolkitComponentId[] | undefined
}

/** Missing settings preserve existing installs; an explicit empty list disables all. */
export function isToolkitComponentEnabled(
  settings: ToolkitComponentSettings | null | undefined,
  id: ToolkitComponentId,
) {
  return (
    settings?.enabledToolkitComponents === undefined ||
    settings.enabledToolkitComponents.includes(id)
  )
}
