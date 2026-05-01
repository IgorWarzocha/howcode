import type { ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { Artifact, ArtifactKind } from "../../shared/desktop-contracts.ts";

export type ArtifactEdit = { oldText: string; newText: string };

export type ArtifactToolAdapter = {
  createArtifact(input: {
    conversationId: string;
    slug: string;
    kind: ArtifactKind;
    content: string;
  }): Promise<Artifact> | Artifact;
  editArtifact(input: {
    conversationId: string;
    slug: string;
    edits: ArtifactEdit[];
  }): Promise<Artifact> | Artifact;
  getArtifact(input: { conversationId: string; slug: string }):
    | Promise<Artifact | null>
    | Artifact
    | null;
  listArtifacts(conversationId: string): Promise<Artifact[]> | Artifact[];
};

const stringSchema = { type: "string" } as const;
const artifactKindSchema = { enum: ["html", "react", "markdown"] } as const;
const editSchema = {
  type: "object",
  properties: { oldText: stringSchema, newText: stringSchema },
  required: ["oldText", "newText"],
  additionalProperties: false,
} as const;

function getConversationId(ctx: ExtensionContext) {
  return ctx.sessionManager?.getSessionFile?.() ?? ctx.sessionManager?.getSessionId?.() ?? "chat";
}

function textResult(text: string, details: unknown = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

export function createArtifactTools(adapter: ArtifactToolAdapter): ToolDefinition[] {
  return [
    {
      name: "create_artifact",
      label: "Create artifact",
      description:
        "Create an artifact for this chat. kind=html is standalone HTML/CSS/JS; kind=react is a default-exported React component; kind=markdown is Markdown text. CDN usage is allowed inside HTML artifacts.",
      promptSnippet: "Create an html, react, or markdown artifact for this chat",
      parameters: {
        type: "object",
        properties: { slug: stringSchema, kind: artifactKindSchema, content: stringSchema },
        required: ["slug", "kind", "content"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const input = params as { slug: string; kind: ArtifactKind; content: string };
        const artifact = await adapter.createArtifact({
          conversationId: getConversationId(ctx),
          slug: input.slug,
          kind: input.kind,
          content: input.content,
        });
        return textResult(`Created artifact ${artifact.slug} version ${artifact.version}.`, {
          artifact,
        });
      },
    },
    {
      name: "edit_artifact",
      label: "Edit artifact",
      description:
        "Edit one artifact in this chat with exact text replacements. Each edits[].oldText must match a unique, non-overlapping region of the current artifact. Merge nearby changes into one edit; use multiple edits for disjoint changes.",
      promptSnippet: "Edit an artifact using exact text replacements",
      parameters: {
        type: "object",
        properties: {
          id: stringSchema,
          edits: {
            type: "array",
            items: editSchema,
            minItems: 1,
          },
        },
        required: ["id", "edits"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const input = params as { id: string; edits: ArtifactEdit[] };
        const artifact = await adapter.editArtifact({
          conversationId: getConversationId(ctx),
          slug: input.id,
          edits: input.edits,
        });
        return textResult(`Edited artifact ${artifact.slug} to version ${artifact.version}.`, {
          artifact,
        });
      },
    },
    {
      name: "read_artifact",
      label: "Read artifact",
      description: "Read the current full content of one artifact in this chat.",
      promptSnippet: "Read an artifact's current content",
      parameters: {
        type: "object",
        properties: { id: stringSchema },
        required: ["id"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const input = params as { id: string };
        const artifact = await adapter.getArtifact({
          conversationId: getConversationId(ctx),
          slug: input.id,
        });
        if (!artifact) throw new Error(`Artifact not found: ${input.id}`);
        return textResult(JSON.stringify(artifact), { artifact });
      },
    },
    {
      name: "list_artifacts",
      label: "List artifacts",
      description: "List artifacts in this chat.",
      promptSnippet: "List artifacts in this chat",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const artifacts = await adapter.listArtifacts(getConversationId(ctx));
        return textResult(
          JSON.stringify(artifacts.map(({ content: _content, ...artifact }) => artifact)),
          { artifacts },
        );
      },
    },
  ];
}

export const artifactToolNames = [
  "create_artifact",
  "edit_artifact",
  "read_artifact",
  "list_artifacts",
];
