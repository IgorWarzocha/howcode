export type ArtifactKind = "html" | "react";

export type Artifact = {
  id: string;
  conversationId: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactVersion = {
  artifactId: string;
  version: number;
  content: string;
  createdAt: string;
};

export type ReactArtifactCompileResult =
  | { ok: true; js: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };
