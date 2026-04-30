import type { ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { Artifact, ArtifactKind } from "../../shared/desktop-contracts.ts";

export type ArtifactToolAdapter = {
  createArtifact(input: {
    conversationId: string;
    title: string;
    kind: ArtifactKind;
    content: string;
  }): Promise<Artifact> | Artifact;
  updateArtifact(input: { artifactId: string; content: string }): Promise<Artifact> | Artifact;
  getArtifact(artifactId: string): Promise<Artifact | null> | Artifact | null;
  listArtifacts(conversationId: string): Promise<Artifact[]> | Artifact[];
};

const stringSchema = { type: "string" } as const;
const artifactKindSchema = { enum: ["html", "react"] } as const;

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
      description: "Create a new interactive artifact displayed in the artifact panel.",
      promptSnippet: "create_artifact: create an html or react artifact in the artifact panel",
      promptGuidelines: [
        "When creating an interactive artifact, call create_artifact instead of writing files.",
        'Use create_artifact kind "html" for standalone HTML/CSS/JS artifacts.',
        'Use create_artifact kind "react" for React artifacts. React artifacts must export a default component.',
        "Do not use external network dependencies in artifacts. Prefer self-contained code and available React/lucide-react imports.",
      ],
      parameters: {
        type: "object",
        properties: { title: stringSchema, kind: artifactKindSchema, content: stringSchema },
        required: ["title", "kind", "content"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const input = params as { title: string; kind: ArtifactKind; content: string };
        const artifact = await adapter.createArtifact({
          conversationId: getConversationId(ctx),
          title: input.title,
          kind: input.kind,
          content: input.content,
        });
        return textResult(
          `Created artifact ${artifact.id} (${artifact.title}) version ${artifact.version}.`,
          { artifact },
        );
      },
    },
    {
      name: "update_artifact",
      label: "Update artifact",
      description: "Replace the full content of an existing artifact and create a new version.",
      promptSnippet: "update_artifact: replace an artifact's full content and create a version",
      promptGuidelines: [
        "When modifying an existing artifact, call read_artifact first unless the current content is already visible in context.",
        "Use update_artifact with the full replacement content, not a patch.",
      ],
      parameters: {
        type: "object",
        properties: { artifactId: stringSchema, content: stringSchema },
        required: ["artifactId", "content"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params) {
        const input = params as { artifactId: string; content: string };
        const artifact = await adapter.updateArtifact({
          artifactId: input.artifactId,
          content: input.content,
        });
        return textResult(`Updated artifact ${artifact.id} to version ${artifact.version}.`, {
          artifact,
        });
      },
    },
    {
      name: "read_artifact",
      label: "Read artifact",
      description: "Read an artifact's current full content.",
      promptSnippet: "read_artifact: read an artifact's current content",
      parameters: {
        type: "object",
        properties: { artifactId: stringSchema },
        required: ["artifactId"],
        additionalProperties: false,
      },
      async execute(_toolCallId, params) {
        const input = params as { artifactId: string };
        const artifact = await adapter.getArtifact(input.artifactId);
        if (!artifact) throw new Error(`Artifact not found: ${input.artifactId}`);
        return textResult(JSON.stringify(artifact), { artifact });
      },
    },
    {
      name: "list_artifacts",
      label: "List artifacts",
      description: "List artifacts for the current or requested conversation.",
      promptSnippet: "list_artifacts: list available artifacts",
      parameters: {
        type: "object",
        properties: { conversationId: { type: "string" } },
        required: [],
        additionalProperties: false,
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const input = params as { conversationId?: string };
        const artifacts = await adapter.listArtifacts(
          input.conversationId ?? getConversationId(ctx),
        );
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
  "update_artifact",
  "read_artifact",
  "list_artifacts",
];
