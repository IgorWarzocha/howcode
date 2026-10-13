import * as Schema from 'effect/Schema'

const identity = {
  id: Schema.String,
  source: Schema.String,
  revision: Schema.String,
  name: Schema.String,
  navigation: Schema.optional(Schema.Boolean),
  activeRevision: Schema.optional(Schema.String),
}
export const InstalledComponentDescriptorSchema = Schema.Union([
  Schema.Struct({ ...identity, status: Schema.Literal('ready'), renderer: Schema.Boolean }),
  Schema.Struct({
    ...identity,
    status: Schema.Literal('pending'),
    reason: Schema.String,
    stage: Schema.Literals(['idle', 'renderer']),
    renderer: Schema.Boolean,
  }),
  Schema.Struct({ ...identity, status: Schema.Literal('error'), error: Schema.String }),
])
export const InstalledComponentCatalogSchema = Schema.mutable(
  Schema.Array(InstalledComponentDescriptorSchema),
)
export const InstalledComponentSourceSchema = Schema.Struct({
  js: Schema.String,
  css: Schema.String,
})
export type InstalledComponentDescriptor = typeof InstalledComponentDescriptorSchema.Type
export type InstalledComponentSource = typeof InstalledComponentSourceSchema.Type
export const InstalledComponentAdmissionSchema = Schema.Struct({
  id: Schema.String,
  revision: Schema.String,
  error: Schema.optional(Schema.String),
})
export type InstalledComponentAdmission = typeof InstalledComponentAdmissionSchema.Type
export const InstalledComponentMutationSchema = Schema.Struct({ source: Schema.String })
export type InstalledComponentMutation = typeof InstalledComponentMutationSchema.Type
export const InstalledComponentStatusSchema = Schema.Struct({
  owner: Schema.Struct({
    generation: Schema.String,
    pid: Schema.Number,
    expiresAt: Schema.Number,
  }),
  inventory: Schema.Array(Schema.Struct({ source: Schema.String, revision: Schema.String })),
  components: InstalledComponentCatalogSchema,
})

/** These public modules contain host-owned framework/context identities. */
export const componentSharedModules = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@tanstack/react-query',
  '@howaboua/howcode-sdk/installed-plugins',
  '@howaboua/howcode-sdk/git-renderer',
  '@howaboua/howcode-sdk/sidebar-renderer',
  '@howaboua/howcode-sdk/navigation',
  '@howaboua/howcode-sdk/outputs',
  '@howaboua/howcode-sdk/workspace-surfaces',
] as const
export const componentModuleBridgeKey = '__howcodeComponentModules'
