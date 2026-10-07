import { Type } from '@earendil-works/pi-ai'
import { defineExtension, defineTool } from '@earendil-works/pi-durable'
import { createArtifact, editArtifact, getArtifact, listArtifacts } from '../artifact-state-db.ts'

export const artifactTools = [
  defineTool({
    name: 'create_artifact',
    description: 'Create an html, react, or markdown artifact for this conversation.',
    parameters: Type.Object({
      slug: Type.String(),
      kind: Type.Union([Type.Literal('html'), Type.Literal('react'), Type.Literal('markdown')]),
      content: Type.String(),
    }),
    async execute(args, api) {
      const artifact = createArtifact({ ...args, conversationId: String(api.conversationId) })
      return {
        content: [
          { type: 'text', text: `Created artifact ${artifact.slug} version ${artifact.version}.` },
        ],
      }
    },
  }),
  defineTool({
    name: 'edit_artifact',
    description: 'Edit an artifact using unique, non-overlapping exact text replacements.',
    parameters: Type.Object({
      id: Type.String(),
      edits: Type.Array(Type.Object({ oldText: Type.String(), newText: Type.String() }), {
        minItems: 1,
      }),
    }),
    async execute(args, api) {
      const artifact = editArtifact({
        slug: args.id,
        edits: args.edits,
        conversationId: String(api.conversationId),
      })
      return {
        content: [
          {
            type: 'text',
            text: `Edited artifact ${artifact.slug} to version ${artifact.version}.`,
          },
        ],
      }
    },
  }),
  defineTool({
    name: 'read_artifact',
    description: 'Read the full current content of an artifact in this conversation.',
    parameters: Type.Object({ id: Type.String() }),
    async execute(args, api) {
      const artifact = getArtifact(args.id, String(api.conversationId))
      if (!artifact) throw new Error(`Artifact not found: ${args.id}`)
      return { content: [{ type: 'text', text: JSON.stringify(artifact) }] }
    },
  }),
  defineTool({
    name: 'list_artifacts',
    description: 'List artifacts in this conversation.',
    parameters: Type.Object({}),
    async execute(_args, api) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              listArtifacts(String(api.conversationId)).map(
                ({ content: _content, ...artifact }) => artifact,
              ),
            ),
          },
        ],
      }
    },
  }),
]

export const CodeArtifactTools = defineExtension({
  name: 'howcode.artifacts',
  tools: artifactTools,
})
