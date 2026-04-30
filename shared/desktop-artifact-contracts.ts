export type ArtifactKind = "html" | "react" | "markdown";

export type Artifact = {
  slug: string;
  conversationId: string;
  kind: ArtifactKind;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactVersion = {
  slug: string;
  version: number;
  content: string;
  createdAt: string;
};

export type ReactArtifactCompileResult =
  | { ok: true; js: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };
