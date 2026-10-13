import * as Schema from 'effect/Schema'

/** Built-in application capabilities. These IDs do not select Durable agent tools. */
export const toolkitComponents = [
  { id: 'terminal', label: 'Terminal', description: 'Interactive workspace terminals.' },
  { id: 'skills', label: 'Skills', description: 'Skill browsing and management.' },
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
